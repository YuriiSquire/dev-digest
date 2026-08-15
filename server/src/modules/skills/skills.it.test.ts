import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../platform/config.js';
import { seed } from '../../db/seed.js';
import * as t from '../../db/schema.js';
import { MockGitClient, MockGitHubClient } from '../../adapters/mocks.js';
import { SkillsRepository } from './repository.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills] Docker not available — skipping integration tests.');
}

/**
 * DB-backed coverage for the skills module: repository CRUD + workspace scoping,
 * the body-only versioning rule (skill_versions snapshot + version bump), the
 * routes via app.inject (incl. Zod 422), and run-level stats correctness (incl.
 * the null-rate case).
 */
d('skills module (integration)', () => {
  let pg: PgFixture;
  let defaultWs: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db
      .select({ id: t.workspaces.id })
      .from(t.workspaces)
      .where(eq(t.workspaces.name, 'default'));
    defaultWs = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  }

  // ---- repository -----------------------------------------------------------

  describe('SkillsRepository', () => {
    it('insert records v1 and snapshots the body into skill_versions', async () => {
      const repo = new SkillsRepository(pg.handle.db);
      const row = await repo.insert({
        workspaceId: defaultWs,
        name: 'Sec',
        type: 'security',
        source: 'manual',
        body: 'v1 body',
      });
      expect(row.version).toBe(1);
      const versions = await repo.listVersions(row.id);
      expect(versions).toHaveLength(1);
      expect(versions[0]).toMatchObject({ version: 1, body: 'v1 body' });
    });

    it('a body change bumps the version and appends a skill_versions row (newest first)', async () => {
      const repo = new SkillsRepository(pg.handle.db);
      const row = await repo.insert({
        workspaceId: defaultWs,
        name: 'Body-versioned',
        type: 'custom',
        source: 'manual',
        body: 'original',
      });

      const updated = await repo.update(defaultWs, row.id, { body: 'changed' });
      expect(updated!.version).toBe(2);
      expect(updated!.body).toBe('changed');

      const versions = await repo.listVersions(row.id);
      expect(versions.map((v) => v.version)).toEqual([2, 1]);
      expect(versions[0]!.body).toBe('changed');
      expect(versions[1]!.body).toBe('original');
    });

    it('name/description/type/enabled edits do NOT bump the version', async () => {
      const repo = new SkillsRepository(pg.handle.db);
      const row = await repo.insert({
        workspaceId: defaultWs,
        name: 'Stable',
        type: 'custom',
        source: 'manual',
        body: 'same body',
      });

      const updated = await repo.update(defaultWs, row.id, {
        name: 'Renamed',
        description: 'now described',
        type: 'rubric',
        enabled: false,
      });
      expect(updated!.version).toBe(1);
      expect(updated!.name).toBe('Renamed');
      expect(updated!.enabled).toBe(false);
      expect(await repo.listVersions(row.id)).toHaveLength(1);
    });

    it('setting body to the same value does not bump the version', async () => {
      const repo = new SkillsRepository(pg.handle.db);
      const row = await repo.insert({
        workspaceId: defaultWs,
        name: 'Idempotent',
        type: 'custom',
        source: 'manual',
        body: 'unchanged',
      });
      const updated = await repo.update(defaultWs, row.id, { body: 'unchanged', name: 'X' });
      expect(updated!.version).toBe(1);
      expect(await repo.listVersions(row.id)).toHaveLength(1);
    });

    it('is workspace-scoped: another tenant cannot read, update, list, or delete it', async () => {
      const repo = new SkillsRepository(pg.handle.db);
      const [otherWs] = await pg.handle.db
        .insert(t.workspaces)
        .values({ name: 'other-tenant' })
        .returning();
      const foreign = await repo.insert({
        workspaceId: otherWs!.id,
        name: 'Foreign',
        type: 'custom',
        source: 'manual',
        body: 'x',
      });

      // Owner sees it; the default workspace does not.
      expect(await repo.getById(otherWs!.id, foreign.id)).toBeDefined();
      expect(await repo.getById(defaultWs, foreign.id)).toBeUndefined();
      const defaultList = await repo.list(defaultWs);
      expect(defaultList.some((s) => s.id === foreign.id)).toBe(false);
      // Cross-tenant update/delete are no-ops.
      expect(await repo.update(defaultWs, foreign.id, { name: 'hijack' })).toBeUndefined();
      expect(await repo.deleteById(defaultWs, foreign.id)).toBe(false);
      expect(await repo.getById(otherWs!.id, foreign.id)).toBeDefined();
    });
  });

  // ---- routes ---------------------------------------------------------------

  describe('routes', () => {
    it('POST creates (201, source manual), GET reads, PUT updates, DELETE removes', async () => {
      const app = await makeApp();
      const created = await app.inject({
        method: 'POST',
        url: '/skills',
        payload: { name: 'Route Skill', body: '# Route Skill\n\nrules', type: 'rubric' },
      });
      expect(created.statusCode).toBe(201);
      const skill = created.json();
      expect(skill).toMatchObject({ name: 'Route Skill', source: 'manual', type: 'rubric', version: 1 });

      const got = await app.inject({ method: 'GET', url: `/skills/${skill.id}` });
      expect(got.statusCode).toBe(200);
      expect(got.json().id).toBe(skill.id);

      const put = await app.inject({
        method: 'PUT',
        url: `/skills/${skill.id}`,
        payload: { body: 'new body' },
      });
      expect(put.statusCode).toBe(200);
      expect(put.json().version).toBe(2);

      const del = await app.inject({ method: 'DELETE', url: `/skills/${skill.id}` });
      expect(del.statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: `/skills/${skill.id}` })).statusCode).toBe(404);
      await app.close();
    });

    it('rejects an invalid create body with 422 (Zod), before the handler', async () => {
      const app = await makeApp();
      const res = await app.inject({ method: 'POST', url: '/skills', payload: { name: '' } });
      expect(res.statusCode).toBe(422);
      await app.close();
    });

    it('POST /skills/import (text) lands a disabled extracted skill named from the heading', async () => {
      const app = await makeApp();
      const res = await app.inject({
        method: 'POST',
        url: '/skills/import',
        payload: { kind: 'text', body: '# Imported\n\nbody' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({
        name: 'Imported',
        source: 'extracted',
        enabled: false,
        type: 'custom',
      });
      await app.close();
    });

    it('POST /skills/import (url) rejects a loopback host with 422', async () => {
      const app = await makeApp();
      const res = await app.inject({
        method: 'POST',
        url: '/skills/import',
        payload: { kind: 'url', url: 'http://localhost:9/s.md' },
      });
      expect(res.statusCode).toBe(422);
      await app.close();
    });

    it('POST /skills/import (community) copies a catalog skill', async () => {
      const app = await makeApp();
      const res = await app.inject({
        method: 'POST',
        url: '/skills/import',
        payload: { kind: 'community', name: 'OWASP Top 10 Reviewer' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ source: 'community', enabled: false });
      await app.close();
    });

    it('GET /skills/community searches the catalog', async () => {
      const app = await makeApp();
      const all = await app.inject({ method: 'GET', url: '/skills/community' });
      expect(all.statusCode).toBe(200);
      expect(all.json().length).toBeGreaterThan(0);

      const filtered = await app.inject({ method: 'GET', url: '/skills/community?q=owasp' });
      expect(filtered.json().map((s: { name: string }) => s.name)).toContain(
        'OWASP Top 10 Reviewer',
      );
      await app.close();
    });

    it('POST /skills/tokens returns a token count', async () => {
      const app = await makeApp();
      const res = await app.inject({
        method: 'POST',
        url: '/skills/tokens',
        payload: { text: 'count these tokens' },
      });
      expect(res.statusCode).toBe(200);
      expect(typeof res.json().tokens).toBe('number');
      expect(res.json().tokens).toBeGreaterThan(0);
      await app.close();
    });

    it('GET /skills/:id/stats 404s for an unknown skill', async () => {
      const app = await makeApp();
      const ghost = '00000000-0000-0000-0000-000000000000';
      expect(
        (await app.inject({ method: 'GET', url: `/skills/${ghost}/stats` })).statusCode,
      ).toBe(404);
      await app.close();
    });
  });

  // ---- stats ----------------------------------------------------------------

  describe('stats', () => {
    it('a skill with no agents/runs has zero counts and null rates', async () => {
      const app = await makeApp();
      const created = await app.inject({
        method: 'POST',
        url: '/skills',
        payload: { name: 'Lonely', body: 'x' },
      });
      const id = created.json().id as string;

      const res = await app.inject({ method: 'GET', url: `/skills/${id}/stats` });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        used_by_agents: 0,
        agents_using: [],
        pull_frequency: null,
        accept_rate: null,
        findings_30d: 0,
        by_category: [],
      });
      await app.close();
    });

    it('computes usage / pull-frequency / accept-rate / 30d / by-category from run_skills', async () => {
      const db = pg.handle.db;
      const repo = new SkillsRepository(db);

      const skill = await repo.insert({
        workspaceId: defaultWs,
        name: 'Stats Skill',
        type: 'security',
        source: 'manual',
        body: 'body',
      });

      // Two agents both link the skill.
      const [a1] = await db
        .insert(t.agents)
        .values({ workspaceId: defaultWs, name: 'Agent One', provider: 'openai', model: 'm', systemPrompt: 'p' })
        .returning();
      const [a2] = await db
        .insert(t.agents)
        .values({ workspaceId: defaultWs, name: 'Agent Two', provider: 'openai', model: 'm', systemPrompt: 'p' })
        .returning();
      await db.insert(t.agentSkills).values([
        { agentId: a1!.id, skillId: skill.id, order: 0 },
        { agentId: a2!.id, skillId: skill.id, order: 0 },
      ]);

      // A repo + PR to hang runs/reviews/findings on.
      const [repoRow] = await db
        .insert(t.repos)
        .values({ workspaceId: defaultWs, owner: 'acme', name: 'stats-repo', fullName: 'acme/stats-repo' })
        .returning();
      const [pr] = await db
        .insert(t.pullRequests)
        .values({
          workspaceId: defaultWs,
          repoId: repoRow!.id,
          number: 1,
          title: 'pr',
          author: 'a',
          branch: 'b',
          base: 'main',
          headSha: 'sha',
        })
        .returning();

      const now = new Date();
      const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // > 30 days

      // A1: 3 runs; A2: 1 run → 4 total runs of the linking agents.
      const mkRun = async (agentId: string, ranAt: Date) => {
        const [r] = await db
          .insert(t.agentRuns)
          .values({ workspaceId: defaultWs, agentId, prId: pr!.id, ranAt })
          .returning();
        return r!.id;
      };
      const r1 = await mkRun(a1!.id, now);
      const r2 = await mkRun(a1!.id, old);
      const r3 = await mkRun(a1!.id, now); // NOT a run_skills run — must be excluded
      const r4 = await mkRun(a2!.id, now); // ditto
      void r3;
      void r4;

      // The skill was pulled into r1 and r2 only → distinct runs = 2.
      await db.insert(t.runSkills).values([
        { runId: r1, skillId: skill.id },
        { runId: r2, skillId: skill.id },
      ]);

      // Reviews for each run (r3 gets one too, to prove it's excluded).
      const mkReview = async (runId: string) => {
        const [rev] = await db
          .insert(t.reviews)
          .values({ workspaceId: defaultWs, prId: pr!.id, runId, kind: 'review' })
          .returning();
        return rev!.id;
      };
      const rev1 = await mkReview(r1);
      const rev2 = await mkReview(r2);
      const rev3 = await mkReview(r3);

      const finding = (
        reviewId: string,
        category: string,
        resolution: 'accepted' | 'dismissed' | 'open',
      ) => ({
        reviewId,
        file: 'f.ts',
        startLine: 1,
        endLine: 1,
        severity: 'WARNING',
        category,
        title: 't',
        rationale: 'r',
        confidence: 0.9,
        acceptedAt: resolution === 'accepted' ? now : null,
        dismissedAt: resolution === 'dismissed' ? now : null,
      });

      await db.insert(t.findings).values([
        // r1 (recent): security accepted, bug dismissed
        finding(rev1, 'security', 'accepted'),
        finding(rev1, 'bug', 'dismissed'),
        // r2 (old): security accepted, security open
        finding(rev2, 'security', 'accepted'),
        finding(rev2, 'security', 'open'),
        // r3 (not a run_skills run): accepted — must NOT count anywhere
        finding(rev3, 'security', 'accepted'),
      ]);

      const stats = await repo.stats(defaultWs, skill.id);

      expect(stats.used_by_agents).toBe(2);
      expect(stats.agents_using).toEqual([
        { agent_id: a1!.id, name: 'Agent One' },
        { agent_id: a2!.id, name: 'Agent Two' },
      ]);
      // 2 distinct run_skills runs ÷ 4 total runs of the linking agents.
      expect(stats.pull_frequency).toBeCloseTo(0.5, 6);
      // accepted (f1,f3)=2, dismissed (f2)=1, open (f4) ignored → 2/3.
      expect(stats.accept_rate).toBeCloseTo(2 / 3, 6);
      // Only r1 (recent) findings, since r2 ran > 30 days ago → 2.
      expect(stats.findings_30d).toBe(2);
      // Histogram over r1+r2 findings (all-time): security 3, bug 1.
      expect(stats.by_category).toEqual([
        { category: 'security', count: 3 },
        { category: 'bug', count: 1 },
      ]);
    });

    it('has a non-null pull_frequency of 0 when linking agents have runs but none pulled the skill', async () => {
      const db = pg.handle.db;
      const repo = new SkillsRepository(db);
      const skill = await repo.insert({
        workspaceId: defaultWs,
        name: 'Unpulled',
        type: 'custom',
        source: 'manual',
        body: 'b',
      });
      const [agent] = await db
        .insert(t.agents)
        .values({ workspaceId: defaultWs, name: 'Runner', provider: 'openai', model: 'm', systemPrompt: 'p' })
        .returning();
      await db.insert(t.agentSkills).values({ agentId: agent!.id, skillId: skill.id, order: 0 });
      await db
        .insert(t.agentRuns)
        .values({ workspaceId: defaultWs, agentId: agent!.id, ranAt: new Date() });

      const stats = await repo.stats(defaultWs, skill.id);
      expect(stats.pull_frequency).toBe(0);
      expect(stats.accept_rate).toBeNull();
      expect(stats.findings_30d).toBe(0);
    });
  });
});
