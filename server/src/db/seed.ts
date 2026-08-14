import 'dotenv/config';
import { createDb, type Db } from './client.js';
import * as t from './schema.js';
import { eq, and } from 'drizzle-orm';
import {
  GENERAL_REVIEWER_PROMPT,
  SECURITY_REVIEWER_PROMPT,
  PERFORMANCE_REVIEWER_PROMPT,
} from './seed-prompts.js';

/** Default provider/model for the built-in reviewer agents. */
const DEFAULT_PROVIDER = 'openrouter' as const;
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

/**
 * Seed the starter's demo data. Idempotent: re-running upserts the default
 * workspace/user and the demo fixtures.
 *
 * Seeds: default workspace + system user + membership, default settings,
 * demo repo (acme/payments-api), PR #482 with files/commits, a sample review
 * with a few findings, and the three built-in agents (General + Security +
 * Performance), all on the default openrouter/deepseek-v4-flash provider+model.
 *
 * Course lessons populate the other tables (skills, conventions, memory, eval,
 * …) once their features are built — they start empty here.
 */

export const DEFAULT_WORKSPACE_NAME = 'default';
export const SYSTEM_USER_EMAIL = 'you@local';

export async function seed(db: Db): Promise<{ workspaceId: string; userId: string }> {
  // ---- workspace + user (no-auth defaults) ----
  let [ws] = await db
    .select()
    .from(t.workspaces)
    .where(eq(t.workspaces.name, DEFAULT_WORKSPACE_NAME));
  if (!ws) {
    [ws] = await db
      .insert(t.workspaces)
      .values({ name: DEFAULT_WORKSPACE_NAME })
      .returning();
  }
  const workspaceId = ws!.id;

  let [user] = await db.select().from(t.users).where(eq(t.users.email, SYSTEM_USER_EMAIL));
  if (!user) {
    [user] = await db
      .insert(t.users)
      .values({ email: SYSTEM_USER_EMAIL, name: 'You' })
      .returning();
  }
  const userId = user!.id;

  await db
    .insert(t.workspaceMembers)
    .values({ workspaceId, userId, role: 'owner' })
    .onConflictDoNothing();

  // ---- default settings ----
  const defaultSettings: Record<string, unknown> = {
    polling_interval_min: 5,
    theme: 'dark',
    density: 'regular',
    sync_to_folder: true,
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await db
      .insert(t.settings)
      .values({ workspaceId, userId, key, value })
      .onConflictDoNothing();
  }

  // ---- demo repo (acme/payments-api) ----
  let [repo] = await db
    .select()
    .from(t.repos)
    .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.fullName, 'acme/payments-api')));
  if (!repo) {
    [repo] = await db
      .insert(t.repos)
      .values({
        workspaceId,
        owner: 'acme',
        name: 'payments-api',
        fullName: 'acme/payments-api',
        defaultBranch: 'main',
        clonePath: null,
        createdBy: userId,
      })
      .returning();
  }
  const repoId = repo!.id;

  // ---- PR #482 (rate limiting) ----
  let [pr] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, 482)));
  if (!pr) {
    [pr] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: 482,
        title: 'Add rate limiting to public API endpoints',
        author: 'marisa.koch',
        branch: 'feat/rate-limit-public',
        base: 'main',
        headSha: 'a1b2c3d4e5f6',
        additions: 247,
        deletions: 38,
        filesCount: 9,
        status: 'needs_review',
        body: 'Add rate limiting to public API endpoints to prevent abuse from unauthenticated clients.',
      })
      .returning();

    // pr_files (subset)
    await db.insert(t.prFiles).values([
      { prId: pr!.id, path: 'src/middleware/ratelimit.ts', additions: 84, deletions: 0 },
      { prId: pr!.id, path: 'src/api/public/webhooks.ts', additions: 31, deletions: 6 },
      { prId: pr!.id, path: 'src/config.ts', additions: 4, deletions: 0 },
      { prId: pr!.id, path: 'src/api/users.ts', additions: 7, deletions: 2 },
    ]);

    // pr_commits
    await db.insert(t.prCommits).values({
      prId: pr!.id,
      sha: 'a1b2c3d4e5f6',
      message: 'Add token-bucket rate limiter',
      author: 'marisa.koch',
    });

    // a sample review + findings so the PR shows results before the first run
    const [review] = await db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: pr!.id,
        kind: 'review',
        verdict: 'request_changes',
        summary:
          'Solid middleware approach, but a Stripe secret key is committed in plaintext and the user-list endpoint introduces an N+1 query under the new limiter.',
        score: 61,
        model: 'seed',
      })
      .returning();

    await db.insert(t.findings).values([
      {
        reviewId: review!.id,
        file: 'src/config.ts',
        startLine: 12,
        endLine: 12,
        severity: 'CRITICAL',
        category: 'security',
        title: 'Hardcoded Stripe secret key in commit',
        rationale: 'Line 12 contains a literal `sk_live_` Stripe secret key.',
        suggestion: 'Move to env var and rotate the key immediately.',
        confidence: 0.98,
      },
      {
        reviewId: review!.id,
        file: 'src/api/users.ts',
        startLine: 45,
        endLine: 52,
        severity: 'WARNING',
        category: 'perf',
        title: 'N+1 query in user list endpoint',
        rationale: 'Loop issues one query per user → N+1.',
        suggestion: 'Use a single IN query and group in memory.',
        confidence: 0.86,
      },
    ]);
  }

  // ---- PR #501 (pricing cache) — drives the PR-list FINDINGS column ----
  // Unlike PR #482 (a `reviews` row but no completed run), this PR also has a
  // `status='done'` agent_runs row carrying the denormalized per-severity counts
  // that the pulls-list route reads for the FINDINGS chips. Kept deliberately
  // self-consistent: 2 CRITICAL + 3 WARNING + 1 SUGGESTION = 6, matching the
  // review's 6 findings that the hover dropdown lazy-fetches. Isolated from #482
  // so existing flows (which key off "Add rate limiting…") don't shift.
  let [prCache] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.repoId, repoId), eq(t.pullRequests.number, 501)));
  if (!prCache) {
    [prCache] = await db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId,
        number: 501,
        title: 'Cache pricing tiers in Redis to cut checkout latency',
        author: 'devon.hale',
        branch: 'feat/pricing-cache',
        base: 'main',
        headSha: 'f0e1d2c3b4a5',
        additions: 190,
        deletions: 22,
        filesCount: 5,
        status: 'needs_review',
        body: 'Cache pricing tiers in Redis so the checkout hot path stops hitting Postgres on every quote.',
      })
      .returning();

    const [cacheReview] = await db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: prCache!.id,
        kind: 'review',
        verdict: 'request_changes',
        summary:
          'Good latency win, but the cache key is attacker-controllable, stale prices can be served after a tier update, and several entries never expire.',
        score: 48,
        model: 'seed',
      })
      .returning();

    // 2 CRITICAL + 3 WARNING + 1 SUGGESTION = 6, matching the run counts below.
    await db.insert(t.findings).values([
      {
        reviewId: cacheReview!.id,
        file: 'src/cache/pricing.ts',
        startLine: 34,
        endLine: 34,
        severity: 'CRITICAL',
        category: 'security',
        title: 'Unbounded cache key from user input',
        rationale: 'The cache key concatenates the raw `plan` query param, so a client can spray unlimited distinct keys and exhaust Redis memory.',
        suggestion: 'Validate `plan` against the known tier set before using it in the key.',
        confidence: 0.95,
      },
      {
        reviewId: cacheReview!.id,
        file: 'src/cache/pricing.ts',
        startLine: 58,
        endLine: 61,
        severity: 'CRITICAL',
        category: 'bug',
        title: 'Stale price served after tier update',
        rationale: 'Tier writes never invalidate the cache, so checkout can quote an old price until the TTL lapses.',
        suggestion: 'Bust the pricing key on tier mutation, or key by tier version.',
        confidence: 0.9,
      },
      {
        reviewId: cacheReview!.id,
        file: 'src/cache/redis.ts',
        startLine: 20,
        endLine: 20,
        severity: 'WARNING',
        category: 'perf',
        title: 'Missing TTL on cached pricing entry',
        rationale: 'SET is issued without an expiry, so entries live until eviction.',
        suggestion: 'Pass an explicit EX matching the pricing refresh window.',
        confidence: 0.82,
      },
      {
        reviewId: cacheReview!.id,
        file: 'src/checkout/quote.ts',
        startLine: 77,
        endLine: 77,
        severity: 'WARNING',
        category: 'bug',
        title: 'Cache miss falls through to a null price',
        rationale: 'On a miss the helper returns undefined and the caller renders `$NaN`.',
        suggestion: 'Fall back to the DB lookup on a miss instead of returning undefined.',
        confidence: 0.8,
      },
      {
        reviewId: cacheReview!.id,
        file: 'src/cache/redis.ts',
        startLine: 12,
        endLine: 12,
        severity: 'WARNING',
        category: 'security',
        title: 'Redis URL used without TLS enforcement',
        rationale: 'The client accepts a plaintext `redis://` URL, so pricing data can travel unencrypted.',
        suggestion: 'Require `rediss://` (TLS) outside local dev.',
        confidence: 0.7,
      },
      {
        reviewId: cacheReview!.id,
        file: 'src/cache/pricing.ts',
        startLine: 5,
        endLine: 5,
        severity: 'SUGGESTION',
        category: 'style',
        title: 'Extract the magic TTL constant',
        rationale: 'The literal `900` appears twice; name it so the intent is clear.',
        suggestion: 'Hoist a `PRICING_TTL_SECONDS` constant.',
        confidence: 0.55,
      },
    ]);

    // Completed run with the denormalized per-severity tally the LIST reads for
    // the FINDINGS chips (2/3/1). Fixed ranAt keeps ordering deterministic.
    await db.insert(t.agentRuns).values({
      workspaceId,
      prId: prCache!.id,
      ranAt: new Date('2026-08-01T00:00:00.000Z'),
      provider: 'seed',
      model: 'seed',
      status: 'done',
      source: 'local',
      costUsd: 0.0123,
      findingsCount: 6,
      score: 48,
      criticalCount: 2,
      warningCount: 3,
      suggestionCount: 1,
    });
  }

  // ---- built-in agents (the three starter presets) ----
  // Prompt bodies live in ./seed-prompts.ts (mirrored in docs/agent-prompts/*.md).
  const seedAgents: Array<typeof t.agents.$inferInsert> = [
    {
      workspaceId,
      name: 'General Reviewer',
      description: 'Reviews a PR diff for bugs, correctness, and clarity.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: GENERAL_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Security Reviewer',
      description: 'Flags secrets, injection, SSRF and the lethal trifecta before merge.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: SECURITY_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
    {
      workspaceId,
      name: 'Performance Reviewer',
      description: 'Catches N+1 queries, missing indexes, and hot-path allocations.',
      provider: DEFAULT_PROVIDER,
      model: DEFAULT_MODEL,
      systemPrompt: PERFORMANCE_REVIEWER_PROMPT,
      enabled: true,
      version: 1,
      createdBy: userId,
    },
  ];
  for (const a of seedAgents) {
    const [existing] = await db
      .select()
      .from(t.agents)
      .where(and(eq(t.agents.workspaceId, workspaceId), eq(t.agents.name, a.name)));
    if (!existing) await db.insert(t.agents).values(a);
  }

  return { workspaceId, userId };
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const handle = createDb(url);
  seed(handle.db)
    .then(async (r) => {
      console.log('✓ seeded', r);
      await handle.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('✗ seed failed:', err);
      await handle.close();
      process.exit(1);
    });
}
