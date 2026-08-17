import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../platform/config.js';
import { seed } from '../../db/seed.js';
import * as t from '../../db/schema.js';
import { MockGitClient, MockLLMProvider, MockSecretsProvider } from '../../adapters/mocks.js';
import { CONVENTION_EXTRACTION_SCHEMA_NAME } from './schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[conventions] Docker not available — skipping integration tests.');
}

/** Files the mock clone exposes; the evidence gate verifies against these. */
const CLONE_FILES: Record<string, string> = {
  'tsconfig.json': '{ "compilerOptions": { "strict": true } }',
  'src/api/users.ts':
    'const user = await db.users.find(id);\nconst posts = await db.posts.findMany({ userId });',
  'src/lib/redis.ts': 'export const redis = new Redis(config.redisUrl);',
};

/** Model output: two real candidates + one fabricated (cites a missing file). */
const EXTRACTION_FIXTURE = {
  candidates: [
    {
      category: 'async',
      rule: 'Always use async/await instead of .then() chains',
      evidence_path: 'src/api/users.ts',
      evidence_snippet: 'const user = await db.users.find(id);',
      confidence: 0.91,
    },
    {
      category: 'infra',
      rule: 'Redis access goes through the src/lib/redis.ts singleton',
      evidence_path: 'src/lib/redis.ts',
      evidence_snippet: 'export const redis = new Redis(config.redisUrl);',
      confidence: 0.85,
    },
    {
      category: 'hallucination',
      rule: 'This cites a file that does not exist',
      evidence_path: 'src/ghost/nowhere.ts',
      evidence_snippet: 'const nope = true;',
      confidence: 0.7,
    },
  ],
};

d('conventions module (integration)', () => {
  let pg: PgFixture;
  let defaultWs: string;
  let repoId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db
      .select({ id: t.workspaces.id })
      .from(t.workspaces)
      .where(eq(t.workspaces.name, 'default'));
    defaultWs = ws!.id;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId: defaultWs, owner: 'acme', name: 'conv-repo', fullName: 'acme/conv-repo' })
      .returning();
    repoId = repo!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  /** App with the extract LLM stubbed + a mock clone. */
  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient({ files: CLONE_FILES }),
        // Bind under EVERY provider key so the extraction mock is used regardless
        // of which provider the `conventions` feature-model default resolves to.
        llm: (() => {
          const m = new MockLLMProvider('openai', {
            structuredBySchema: { [CONVENTION_EXTRACTION_SCHEMA_NAME]: EXTRACTION_FIXTURE },
          });
          return { openai: m, anthropic: m, openrouter: m };
        })(),
      },
    });
  }

  it('POST extract → verifies evidence, drops the fabricated citation, persists pending', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/extract`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // The hallucinated candidate (missing file) is gone; two real ones remain.
    expect(body.candidates.map((c: { rule: string }) => c.rule).sort()).toEqual([
      'Always use async/await instead of .then() chains',
      'Redis access goes through the src/lib/redis.ts singleton',
    ]);
    expect(body.candidates.every((c: { status: string }) => c.status === 'pending')).toBe(true);
    expect(body.sample_count).toBeGreaterThan(0);
    await app.close();
  });

  it('GET lists the persisted candidates; a re-scan replaces (not appends) the set', async () => {
    const app = await makeApp();
    await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    const list = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` });
    expect(list.statusCode).toBe(200);
    // Still 2 — the second scan replaced the first, did not double it.
    expect(list.json()).toHaveLength(2);
    await app.close();
  });

  it('accept / reject flip status (and mirror accepted) and survive reload', async () => {
    const app = await makeApp();
    await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    const list = (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json();
    const id = list[0].id as string;

    const acc = await app.inject({ method: 'POST', url: `/conventions/${id}/accept` });
    expect(acc.statusCode).toBe(200);
    expect(acc.json()).toMatchObject({ status: 'accepted', accepted: true });

    const rej = await app.inject({ method: 'POST', url: `/conventions/${list[1].id}/reject` });
    expect(rej.json()).toMatchObject({ status: 'rejected', accepted: false });

    // Reload proves persistence.
    const reloaded = (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json();
    expect(reloaded.find((c: { id: string }) => c.id === id).status).toBe('accepted');
    await app.close();
  });

  it('list order is stable across an accept — no reordering on status change', async () => {
    const app = await makeApp();
    // A dedicated repo so other tests' extract (deleteByRepo) can't disturb it.
    const [r] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId: defaultWs, owner: 'acme', name: 'order-repo', fullName: 'acme/order-repo' })
      .returning();
    const orderRepoId = r!.id;

    // Reproduce a scan batch: one INSERT → every row shares the same created_at
    // (Postgres now() is transaction-start time) and an identical confidence, so
    // the ONLY thing that can give a deterministic order is the id tiebreaker.
    const runId = randomUUID();
    await pg.handle.db.insert(t.conventions).values(
      Array.from({ length: 6 }, (_, i) => ({
        workspaceId: defaultWs,
        repoId: orderRepoId,
        category: 'batch',
        rule: `rule ${i}`,
        evidencePath: 'src/api/users.ts',
        evidenceSnippet: 'const user = await db.users.find(id);',
        confidence: 0.9, // all tied
        status: 'pending' as const,
        accepted: false,
        extractionRunId: runId,
      })),
    );

    const before = (
      await app.inject({ method: 'GET', url: `/repos/${orderRepoId}/conventions` })
    ).json() as { id: string }[];
    expect(before).toHaveLength(6);
    const orderBefore = before.map((c) => c.id);

    // With every sort key tied, a correct query falls back to the id tiebreaker,
    // so the returned order must equal the ids sorted ascending. Without the
    // tiebreaker this is unspecified heap (insertion) order and won't match.
    expect(orderBefore).toEqual([...orderBefore].sort());

    // Accept a MIDDLE candidate — the classic trigger for a heap-order shift.
    const middle = orderBefore[3]!;
    const acc = await app.inject({ method: 'POST', url: `/conventions/${middle}/accept` });
    expect(acc.statusCode).toBe(200);

    const after = (
      await app.inject({ method: 'GET', url: `/repos/${orderRepoId}/conventions` })
    ).json() as { id: string }[];
    // The mutation must not reorder the list.
    expect(after.map((c) => c.id)).toEqual(orderBefore);
    await app.close();
  });

  it('PUT edits a candidate; an invalid body is 422 before the handler', async () => {
    const app = await makeApp();
    await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    const id = (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json()[0].id;

    const put = await app.inject({
      method: 'PUT',
      url: `/conventions/${id}`,
      payload: { rule: 'Edited rule text' },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().rule).toBe('Edited rule text');

    const bad = await app.inject({
      method: 'PUT',
      url: `/conventions/${id}`,
      payload: { rule: 123 },
    });
    expect(bad.statusCode).toBe(422);
    await app.close();
  });

  it('POST skill bundles accepted conventions into a convention/extracted skill', async () => {
    const app = await makeApp();
    await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    const list = (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json();
    const ids = list.map((c: { id: string }) => c.id);
    for (const id of ids) await app.inject({ method: 'POST', url: `/conventions/${id}/accept` });

    const res = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill`,
      payload: {
        name: 'conv-repo-conventions',
        description: '2 house conventions',
        body: '# conv-repo-conventions\n\n## async\n...',
        enabled: true,
        convention_ids: ids,
      },
    });
    expect(res.statusCode).toBe(201);
    const skill = res.json();
    expect(skill).toMatchObject({ name: 'conv-repo-conventions', type: 'convention', source: 'extracted', enabled: true });
    expect(skill.evidence_files.sort()).toEqual(['src/api/users.ts', 'src/lib/redis.ts']);

    // The skill is now listed in the Skills Lab.
    const skills = (await app.inject({ method: 'GET', url: '/skills' })).json();
    expect(skills.some((s: { id: string }) => s.id === skill.id)).toBe(true);
    await app.close();
  });

  it('extract with no LLM key returns a clear 4xx (not 500)', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient({ files: CLONE_FILES }),
        secrets: new MockSecretsProvider({}), // no OPENAI_API_KEY → ConfigError at call time
      },
    });
    const res = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('llm_not_configured');
    await app.close();
  });
});
