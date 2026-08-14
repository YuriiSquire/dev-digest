/**
 * PER-SEVERITY FINDINGS columns on GET /repos/:id/pulls
 * (critical_count / warning_count / suggestion_count).
 *
 * These read the denormalized columns on agent_runs, but — unlike `cost_usd`,
 * which is the single latest completed run — they SUM each AGENT's latest
 * completed run, so the list reflects what EVERY review agent flagged rather than
 * just whichever finished last. Rows are selected newest-first, the first row
 * seen per (pr, agent) is that agent's latest, and only status='done' rows count.
 * That ordering + per-agent dedupe + status filter is real SQL, so it gets a real
 * Postgres rather than a mock DB. Sibling of `pulls-cost.it.test.ts`.
 *
 * The edges worth pinning: the counts are SUMMED across agents (while cost stays
 * the single latest run's), only each agent's LATEST run counts (an older
 * same-agent run is superseded, not added), a never-reviewed PR reports null (not
 * 0) for all three, and a newer FAILED run must not blank out the last successful
 * run's counts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockGitHubClient } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';
import type { PrMeta } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

let repoSeq = 0;

/** A repo with one PR, created directly (no GitHub sync) so runs can attach to it. */
async function setupRepoAndPr(db: PgFixture['handle']['db'], workspaceId: string) {
  const name = `findings-${repoSeq++}`;
  const [repo] = await db
    .insert(t.repos)
    .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
    .returning();
  const [pr] = await db
    .insert(t.pullRequests)
    .values({
      workspaceId,
      repoId: repo!.id,
      number: 517,
      title: 'Harden auth middleware against token replay',
      author: 'devon.reyes',
      branch: 'fix/token-replay',
      base: 'main',
      headSha: 'f00dbabe',
      additions: 132,
      deletions: 21,
      filesCount: 6,
      status: 'open',
    })
    .returning();
  return { repo: repo!, pr: pr! };
}

/** A review agent to attach runs to, so the per-agent sum has real agent ids. */
async function addAgent(db: PgFixture['handle']['db'], workspaceId: string, name: string) {
  const [agent] = await db
    .insert(t.agents)
    .values({
      workspaceId,
      name,
      provider: 'openrouter',
      model: 'deepseek/deepseek-v4-flash',
      systemPrompt: 'Review the diff.',
    })
    .returning();
  return agent!;
}

async function addRun(
  db: PgFixture['handle']['db'],
  workspaceId: string,
  prId: string,
  values: {
    ranAt: Date;
    status: string;
    criticalCount: number | null;
    warningCount: number | null;
    suggestionCount: number | null;
    /** Attach to a specific agent so per-agent latest dedupe can be exercised. */
    agentId?: string;
    /** Override the default cost so the cost-vs-sum divergence can be asserted. */
    costUsd?: number | null;
  },
) {
  await db.insert(t.agentRuns).values({
    workspaceId,
    prId,
    model: 'deepseek/deepseek-v4-flash',
    provider: 'openrouter',
    tokensIn: 8000,
    tokensOut: 500,
    durationMs: 1200,
    costUsd: 0.0021,
    findingsCount:
      (values.criticalCount ?? 0) + (values.warningCount ?? 0) + (values.suggestionCount ?? 0),
    grounding: '3/3 passed',
    ...values,
  });
}

/** The list route syncs from GitHub first; an empty mock keeps it a no-op. */
const listPulls = async (db: PgFixture['handle']['db'], repoId: string) => {
  const app = await buildApp({
    config: config(),
    db,
    overrides: { github: new MockGitHubClient({ pulls: [] }) },
  });
  const res = await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` });
  expect(res.statusCode).toBe(200);
  return res.json() as PrMeta[];
};

d('PR list per-severity findings columns (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('surfaces the latest completed run counts on the list row', async () => {
    const { repo, pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    await addRun(pg.handle.db, workspaceId, pr.id, {
      ranAt: new Date('2026-06-01T09:00:00Z'),
      status: 'done',
      criticalCount: 2,
      warningCount: 5,
      suggestionCount: 8,
    });

    const [row] = await listPulls(pg.handle.db, repo.id);
    expect(row!.critical_count).toBe(2);
    expect(row!.warning_count).toBe(5);
    expect(row!.suggestion_count).toBe(8);
  });

  it('SUMS each agent’s latest run — while cost stays the single latest run', async () => {
    const { repo, pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const agentA = await addAgent(pg.handle.db, workspaceId, 'Security Reviewer');
    const agentB = await addAgent(pg.handle.db, workspaceId, 'Performance Reviewer');
    // Agent A finished first (its run is the older of the two).
    await addRun(pg.handle.db, workspaceId, pr.id, {
      agentId: agentA.id,
      ranAt: new Date('2026-06-01T09:00:00Z'),
      status: 'done',
      criticalCount: 2,
      warningCount: 5,
      suggestionCount: 8,
      costUsd: 0.0012,
    });
    // Agent B finished LAST — so it owns the cost, but its counts must be ADDED,
    // not replace A's.
    await addRun(pg.handle.db, workspaceId, pr.id, {
      agentId: agentB.id,
      ranAt: new Date('2026-06-01T10:00:00Z'),
      status: 'done',
      criticalCount: 1,
      warningCount: 1,
      suggestionCount: 1,
      costUsd: 0.0031,
    });

    const [row] = await listPulls(pg.handle.db, repo.id);
    // Sums across BOTH agents (a single latest run would report 1/1/1).
    expect(row!.critical_count).toBe(3);
    expect(row!.warning_count).toBe(6);
    expect(row!.suggestion_count).toBe(9);
    // Cost is unchanged semantics: the single latest completed run (agent B).
    expect(row!.cost_usd).toBeCloseTo(0.0031, 6);
  });

  it('counts only each agent’s LATEST run — an older same-agent run is superseded', async () => {
    const { repo, pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const agentA = await addAgent(pg.handle.db, workspaceId, 'Security Reviewer');
    await addRun(pg.handle.db, workspaceId, pr.id, {
      agentId: agentA.id,
      ranAt: new Date('2026-06-01T09:00:00Z'),
      status: 'done',
      criticalCount: 1,
      warningCount: 1,
      suggestionCount: 1,
    });
    // A newer run from the SAME agent replaces the older one — not added to it.
    await addRun(pg.handle.db, workspaceId, pr.id, {
      agentId: agentA.id,
      ranAt: new Date('2026-06-01T11:00:00Z'),
      status: 'done',
      criticalCount: 9,
      warningCount: 0,
      suggestionCount: 0,
    });

    const [row] = await listPulls(pg.handle.db, repo.id);
    // 10/1/1 would mean both same-agent runs were summed.
    expect(row!.critical_count).toBe(9);
    expect(row!.warning_count).toBe(0);
    expect(row!.suggestion_count).toBe(0);
  });

  it('reports null — never 0 — for every count on a never-reviewed PR', async () => {
    const { repo } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const [row] = await listPulls(pg.handle.db, repo.id);
    expect(row!.critical_count).toBeNull();
    expect(row!.warning_count).toBeNull();
    expect(row!.suggestion_count).toBeNull();
  });

  it('ignores a newer failed run so the last successful counts survive', async () => {
    const { repo, pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    await addRun(pg.handle.db, workspaceId, pr.id, {
      ranAt: new Date('2026-06-01T09:00:00Z'),
      status: 'done',
      criticalCount: 1,
      warningCount: 3,
      suggestionCount: 4,
    });
    await addRun(pg.handle.db, workspaceId, pr.id, {
      ranAt: new Date('2026-06-01T11:00:00Z'),
      status: 'failed',
      criticalCount: null,
      warningCount: null,
      suggestionCount: null,
    });

    const [row] = await listPulls(pg.handle.db, repo.id);
    expect(row!.critical_count).toBe(1);
    expect(row!.warning_count).toBe(3);
    expect(row!.suggestion_count).toBe(4);
  });
});
