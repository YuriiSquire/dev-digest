import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { waitForPrRuns } from '../../../test/helpers/runs.js';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../platform/config.js';
import { seed } from '../../db/seed.js';
import { MockLLMProvider, MockEmbedder, MockGitClient } from '../../adapters/mocks.js';
import * as t from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';
import type { Review } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

/** A diff touching src/config.ts line 11 so grounding keeps the fixture finding. */
const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

/** One grounded finding (line 11) — enough for a successful, persisted run. */
const REVIEW_FIXTURE: Review = {
  verdict: 'request_changes',
  summary: 'Hardcoded Stripe secret introduced.',
  score: 42,
  findings: [
    {
      id: 'f-valid',
      severity: 'CRITICAL',
      category: 'security',
      title: 'Hardcoded Stripe secret key',
      file: 'src/config.ts',
      start_line: 11,
      end_line: 11,
      rationale: 'A live Stripe key is committed in source.',
      suggestion: 'Move the key to an environment variable.',
      confidence: 0.95,
      kind: 'finding',
    },
  ],
};

// Distinct sentinel bodies so we can assert presence, order, and exclusion in the
// assembled '## Skills / rules' section.
const ALPHA_BODY = 'ALPHA-SKILL-BODY: rubric for uncovered branches.';
const BETA_BODY = 'BETA-SKILL-BODY: this one is DISABLED and must not appear.';
const GAMMA_BODY = 'GAMMA-SKILL-BODY: checklist for flaky tests.';

let seq = 0;
async function setupRepoAndPr(db: PgFixture['handle']['db'], workspaceId: string) {
  const name = `skills-repo-${seq++}`;
  const [repo] = await db
    .insert(t.repos)
    .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
    .returning();
  const [pr] = await db
    .insert(t.pullRequests)
    .values({
      workspaceId,
      repoId: repo!.id,
      number: 900,
      title: 'Skills wiring PR',
      author: 'tester',
      branch: 'feat/skills',
      base: 'main',
      headSha: 'deadbeef',
      additions: 1,
      deletions: 0,
      filesCount: 1,
      status: 'needs_review',
      body: 'Wire linked skills into the prompt.',
    })
    .returning();
  await db.insert(t.prFiles).values({
    prId: pr!.id,
    path: 'src/config.ts',
    additions: 1,
    deletions: 0,
    patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
  });
  return { repo: repo!, pr: pr! };
}

d('run-executor: linked skills → prompt assembly + run_skills (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    const { workspaceId: ws } = await seed(pg.handle.db);
    workspaceId = ws;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('injects only enabled skill bodies in order and records exactly them in run_skills', async () => {
    const db = pg.handle.db;
    const app = await buildApp({
      config: config(),
      db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: DIFF }),
        llm: { openai: new MockLLMProvider('openai', { structured: REVIEW_FIXTURE }) },
      },
    });

    // Agent with repo-intel off — keeps the assembled prompt to system + skills +
    // diff, so the assertions below don't depend on repo-intel enrichment.
    const [agent] = await db
      .insert(t.agents)
      .values({
        workspaceId,
        name: 'Skills Under Test',
        provider: 'openai',
        model: 'gpt-4.1',
        systemPrompt: 'You are a reviewer.',
        repoIntel: false,
      })
      .returning();

    // Three skills: alpha (enabled), beta (DISABLED), gamma (enabled).
    const skillRows = await db
      .insert(t.skills)
      .values([
        {
          workspaceId,
          name: 'alpha-enabled',
          description: 'a',
          type: 'rubric',
          source: 'manual',
          enabled: true,
          body: ALPHA_BODY,
        },
        {
          workspaceId,
          name: 'beta-disabled',
          description: 'b',
          type: 'custom',
          source: 'manual',
          enabled: false,
          body: BETA_BODY,
        },
        {
          workspaceId,
          name: 'gamma-enabled',
          description: 'g',
          type: 'convention',
          source: 'manual',
          enabled: true,
          body: GAMMA_BODY,
        },
      ])
      .returning();
    const byName = new Map(skillRows.map((s) => [s.name, s]));
    const alpha = byName.get('alpha-enabled')!;
    const beta = byName.get('beta-disabled')!;
    const gamma = byName.get('gamma-enabled')!;

    // Link in order: alpha=0, beta=1 (disabled), gamma=2. linkedSkills orders by
    // `order` asc, so the enabled pulled set is [alpha, gamma] in that order.
    await db.insert(t.agentSkills).values([
      { agentId: agent!.id, skillId: alpha.id, order: 0 },
      { agentId: agent!.id, skillId: beta.id, order: 1 },
      { agentId: agent!.id, skillId: gamma.id, order: 2 },
    ]);

    const { pr } = await setupRepoAndPr(db, workspaceId);

    const body = (
      await app.inject({
        method: 'POST',
        url: `/pulls/${pr.id}/review`,
        payload: { agentId: agent!.id },
      })
    ).json();
    const runId = body.runs[0].run_id as string;

    await waitForPrRuns(db, pr.id, { expected: 1 });

    // (a) persisted trace prompt_assembly.skills — enabled bodies IN ORDER, no disabled.
    const trace = (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
    const skillsBlock: string = trace.prompt_assembly.skills;
    expect(skillsBlock).toContain(ALPHA_BODY);
    expect(skillsBlock).toContain(GAMMA_BODY);
    expect(skillsBlock).not.toContain(BETA_BODY);
    expect(skillsBlock.indexOf(ALPHA_BODY)).toBeLessThan(skillsBlock.indexOf(GAMMA_BODY));

    // (b) run_skills has exactly the two enabled rows (alpha + gamma), not beta.
    const runSkillRows = await db
      .select()
      .from(t.runSkills)
      .where(eq(t.runSkills.runId, runId));
    expect(runSkillRows).toHaveLength(2);
    const recorded = new Set(runSkillRows.map((r) => r.skillId));
    expect(recorded.has(alpha.id)).toBe(true);
    expect(recorded.has(gamma.id)).toBe(true);
    expect(recorded.has(beta.id)).toBe(false);

    // sanity: the run completed successfully
    const [run] = await db.select().from(t.agentRuns).where(and(eq(t.agentRuns.id, runId)));
    expect(run!.status).toBe('done');

    await app.close();
  });
});
