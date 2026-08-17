# Insights — server

Server-side decisions and dead ends. Read before redesigning anything here; a
lot of what looks arbitrary was a deliberate trade-off.

Read at the start of a task, written at the end of one, by the
`engineering-insights` skill. Sections are fixed — add to the one that fits,
newest first. If it would be obvious to anyone reading the code, leave it out.

Formats — `Decisions` takes prose; every other section takes a dated bullet:

```markdown
### YYYY-MM-DD — <short title>

**What:** the decision, in one sentence.
**Why:** the constraint that forced it.
**Rejected:** what we tried or considered, and how it failed.
```

```markdown
- **YYYY-MM-DD** — <the claim, specific enough to act on cold>.
  `src/path/to/file.ts:42`
```

Roughly 5 entries per section. Promote stable entries into `docs/` and delete
them here. Insights about `src/vendor/shared/` go in the **root** `INSIGHTS.md` —
a contract change reaches every package.

---

## Decisions

### 2026-07-31 — Schema-first validation at the route boundary

**What:** every route declares Zod `params`/`body`/response schemas from
`@devdigest/shared` via `fastify-type-provider-zod`; invalid input is rejected
with `422` before the handler runs.
**Why:** one definition has to drive both request validation and response
serialization, or the two drift.
**Rejected:** hand-rolled `Schema.parse(req.body)` inside each handler — it
validated input only, left responses unchecked, and duplicated the schema
reference in every route.

## What Works

_None yet._

## What Doesn't Work

- **2026-08-16** — A skills-vs-no-skills A/B on the "API Contract Reviewer"
  agent (`deepseek/deepseek-v4-flash`) does NOT differentiate when the target PR
  is a *blatant* contract break. Tested on dev-digest PR #3 (renames response
  field `head_sha` → `headSha` in the `PrMeta` Zod contract): unbinding all 4
  skills (`POST /agents/:id/skills {"skill_ids":[]}`), reviewing, then re-binding
  and reviewing again gave an **identical** verdict both ways — 1 CRITICAL
  finding, `verdict: "request_changes"` — even though the skills were genuinely
  injected (trace `prompt_assembly.skills` is a ~3.5k-char string with the
  breaking-change rule, vs `null` when unbound). Skills only *enriched* the
  rationale (WITH cites "violates API contract stability rules" + sunset/semver
  framing; WITHOUT already said "no deprecation window / no major version bump").
  Cause: the change is announced verbatim in the PR title/description and the
  agent's own system prompt ("API Contract Reviewer") already primes it, so the
  base model catches it unaided. To demonstrate skills changing catch-vs-miss you
  need a **subtle** contract change the base model misses on its own — a rename
  spelled out in the PR text is the wrong probe. Run ids: `78726d1b…` (no skills,
  $0.00042), `01992df8…` (skills, $0.00049). `GET /runs/:id/trace` → `stats` +
  `raw_output`.

- **2026-08-16** — Sequel to the entry above: the skills DO flip miss→catch, but
  only with the right probe AND a non-primed agent. Probe that works: flip a
  *required* response field to optional — `PrMeta.base: z.string()` →
  `z.string().optional()` (fork PR `YuriiSquire/dev-digest#4`). It is zero
  typecheck-cascade (a definite value is still assignable to an optional field,
  and `base` is only read as JSX text client-side), squarely in the
  `response-schema` rubric ("required-ness changed … or vice versa"), yet
  benign-looking so a neutral reviewer waves it through. On a FRESH generic agent
  (neutral "review this PR" prompt, same `deepseek/deepseek-v4-flash`) it flipped
  cleanly: no skills → `verdict:"approve"`, one WARNING, let through (run
  `1375d8f7…`, $0.00072); 4 skills bound → `verdict:"request_changes"`, 2 CRITICAL
  (breaking-change + missing semver bump) (run `f9b152c6…`, $0.00097). On the real
  "API Contract Reviewer" agent there was NO flip — CRITICAL/request_changes both
  ways (`c7bbd501…` no-skills / `50adfcb4…` skills) because its own system prompt
  already enumerates "narrowing a type / optional→required", so isolate the
  skills' effect on a generic agent, not this one. Wrong probe: a constraint
  refinement like `title: z.string().max(72)` — NOT named by any rubric (so skills
  add no signal) yet a generic no-skills agent still flags it by general reasoning
  ("arbitrary limit rejects long PR titles"), so it never flips.

## Codebase Patterns

- **2026-08-16** — [dev-data state] Not every seeded repo has reviewable diffs.
  The `acme/payments-api` repo (id `789fd462…`, `last_polled_at: null`,
  `clone_path: null`) returns PRs whose `GET /pulls/:id` gives **empty** files —
  entries with `filename: null` / empty `patch`, or `files: []` (PRs #482, #501,
  #517). Reviewing them yields a trivial "approve" with nothing to flag. Only
  `YuriiSquire/dev-digest` and `squire-technologies/squire-mobile-commander`
  (both with a non-null `last_polled_at`/`clone_path`) carry real per-file
  patches. When picking a review target, confirm `GET /pulls/:id` actually
  returns non-empty `files[].patch` before trusting the run.

- **2026-08-16** — `getConventionSamples` (and every rank-driven file sample)
  EXCLUDES config files: `JUNK_PATH_PATTERNS` substring-drops `.config.`,
  `eslint`, `prettier` (alongside tests / `.d.ts` / `/migrations/`) before
  returning the top-`file_rank` paths. Counterintuitive for a *convention*
  extractor — the most convention-dense files (`.eslintrc*`, `tsconfig.json`,
  `.prettierrc*`) never appear in the sample, so an extractor must read those
  directly from the clone (`RepoIntelRepository.getRepoBasics().clonePath` + the
  `readClone` pattern), not via the sampler.
  `server/src/modules/repo-intel/service.ts:723` (JUNK_PATH_PATTERNS), `:630`
  (getConventionSamples).

- **2026-08-12** — The PR-list FINDINGS column aggregates ACROSS agents by
  **summing the denormalized per-run counters** — never a JOIN over `findings`
  (consistent with the 2026-08-04 note below). `GET /repos/:id/pulls`
  (`pulls/routes.ts`) takes the latest `status='done'` run **per (pr, agent)**
  (`ranAt desc`, first-seen wins, keyed `` `${prId}:${agentId ?? runId}` ``) and
  sums their `critical/warning/suggestion_count` into `PrMeta.*_count`. It is
  deliberately NOT deduped — two agents flagging the same file:line count twice —
  because there is no finding fingerprint (file+line+rule) anywhere in the schema
  to dedup on; the list hover attributes findings by agent instead. COST in the
  same rollup stays the single latest run's (not summed), so the two columns
  diverge on purpose. `server/src/modules/pulls/routes.ts`
  (findingsByPr / latestCostByPr), spec `specs/03-findings-aggregate.md`.

- **2026-08-04** — `agent_runs` counters (`findings_count`, `blockers`, and now
  `critical_count`/`warning_count`/`suggestion_count`) are denormalized onto the
  run row once, at run completion in `run-executor.ts`, and never recomputed —
  even after a finding is later accepted/dismissed. This is intentional: the
  timeline shows the deterministic CI-gate snapshot, not a live view. A new
  per-severity/per-status counter on a run belongs in this same
  compute-once-at-write-time path (new column + migration), not a read-time
  `JOIN`/`GROUP BY` over `findings` — the latter would silently diverge from
  `blockers`' semantics (gate-tripped at run time vs. currently-live findings).
  `server/src/modules/reviews/run-executor.ts:238` (blockers/counts computed),
  `server/src/modules/reviews/repository/run.repo.ts:40` (read path, no
  aggregation query).

- **2026-08-04** — `ReviewRepository` in `repository.ts` re-declares each repo
  function's params type inline instead of importing it from the
  `repository/*.repo.ts` module that owns it (e.g. `completeAgentRun`'s
  `values` shape is written out twice: `repository.ts:153` and
  `repository/run.repo.ts:148`). Adding a field to one and not the other
  type-errors immediately at the call site, but only because both call sites
  happen to be typechecked in the same `tsc` run — it is easy to touch only one
  copy and get a real but confusing error pointing at the *caller*, not the
  missing field.

## Tool & Library Notes

- **2026-08-15** — Each `*.it.test.ts` spins its OWN Postgres testcontainer in
  `beforeAll` (`test/helpers/pg.ts` `startPg`). Running the whole suite in parallel
  (11 files → 11 concurrent containers) is resource-bound on a laptop and fails
  **non-deterministically** — e.g. a review run's `prompt_assembly` comes back
  undefined because `waitForPrRuns` timed out, and the failing file set changes run
  to run. A file that fails in the full run passes in isolation. For a reliable
  local full run: `pnpm exec vitest run .it.test --no-file-parallelism` (serial,
  ~36s, all green). Don't chase a "regression" from a flaky full-suite run before
  re-running the failing file alone. `server/test/helpers/pg.ts`

## Recurring Errors & Fixes

- **2026-08-16** — `origin/main` does NOT yet have the skill-injection wiring in
  `run-executor.ts` (`agentsRepo.linkedSkills(agent.id)` → filter `enabled` →
  insert `run_skills` → pass `skills: pulled.map(l => l.skill.body)` into
  `reviewPullRequest`) — that only exists on feature branches (confirmed present
  on `feat/lab2-hw`; PR #2 "feat(skills): reusable skills" merged to `develop`,
  not `main`). On `main`, `run-executor.ts` hardcodes
  `prompt_assembly: { skills: null, ... }` and never queries `agent_skills` at
  all. Symptom: an agent shows skills correctly linked+enabled via
  `GET /agents/:id/skills`, a review run completes normally, but `run_skills`
  stays empty and the trace's `prompt_assembly.skills` is `null` — the skills
  had zero effect on the LLM output even though the API reported them attached.
  If testing agent+skill behavior, make sure the code actually executing is on a
  branch that has this wiring, not `main`. `server/src/modules/reviews/run-executor.ts:189-219`.

- **2026-08-16** — `GET /repos/:id/pulls` (list sync) does NOT persist per-file
  patches — only `GET /pulls/:id` (detail) calls `getPullRequest` and writes
  `pr_files.patch`. Triggering `POST /pulls/:id/review` right after only the list
  sync gets an empty diff and the agent legitimately (and silently) returns
  `verdict: "approve"` / 0 findings / "The diff is empty" — this looks like the
  agent missed something but it was never shown a diff. Always `GET /pulls/:id`
  once before the first review run on a freshly-synced PR. `server/src/modules/pulls/routes.ts`.

- **2026-08-16** — Changing a feature-model's default PROVIDER silently breaks any
  it-test / fixture that injects its `MockLLMProvider` under a HARDCODED provider
  key. When `conventions` flipped `openai` → `openrouter`/`deepseek/deepseek-v4-flash`
  (`platform.ts` `FEATURE_MODELS`), `resolveFeatureModel` returned `openrouter`, so
  `container.llm('openrouter')` bypassed the `openai`-only mock in
  `conventions.it.test.ts` (`makeApp`) and `platform/e2e-fixtures.ts` and hit the
  REAL provider — a configured `OPENROUTER_API_KEY` made it "succeed" with real,
  non-deterministic output (e.g. "Enable strict type checking" citing
  `tsconfig.json`), reddening 4/6 tests. Tell-tale: the file's runtime jumps from
  ~3s to ~37s (real network latency). Fix: bind the mock under ALL provider keys
  (`{ openai: m, anthropic: m, openrouter: m }`) so fixtures never couple to the
  resolved provider. (Corrects an earlier note that called these "pre-existing /
  unrelated" — they were a regression from the default swap, now green 7/7.)

- **2026-08-16** — The conventions list visibly reorders when a suggestion is
  accepted/rejected. Cause: `ConventionsRepository.listByRepo`
  (`server/src/modules/conventions/repository.ts:47-53`) orders only by
  `desc(confidence)` with no secondary tiebreaker — ties (all 8 seed rows sit
  at `confidence = 1`, and real LLM scores commonly round to the same 0.8/0.9)
  get an unstable order from Postgres, and an `UPDATE` (the accept/reject
  write) is exactly when that order is likely to shift. Confirmed NOT a client
  bug: `client/src/lib/hooks/conventions.ts:31-38` just invalidates + refetches
  (no optimistic write), and `ConventionsListView.tsx:118-127` renders with a
  stable `key={c.id}`, no re-sort. **Fixed 2026-08-16 in
  `repository.ts:54`** — `.orderBy(desc(confidence), asc(createdAt), asc(id))`.
  NOTE: `asc(createdAt)` alone is INERT as a tiebreaker here — `now()`
  (`db/schema/_shared.ts`) is `defaultNow()`, i.e. Postgres transaction-start
  time, so a scan's single-statement `insertMany` gives every candidate the
  IDENTICAL `created_at`; combined with confidence ties this leaves heap order
  to break the tie. `asc(id)` (unique PK, never mutated) is the key that
  actually pins the order. Any list query over a batch-inserted table needs a
  unique final key, not `created_at`. Regression lock:
  `conventions.it.test.ts` "list order is stable across an accept".

- **2026-08-16** — `pnpm db:migrate` printing `✓ migrations applied` (or even
  succeeding after a prior fix) is not proof the live schema matches
  `src/db/schema/*.ts` — this local dev DB's history has old, never-cleanly-
  reconciled schema drift, and it resurfaces per-table as new migrations get
  generated. Second occurrence: after fixing `agent_runs` (missing
  `critical_count`/etc.), the next restart hit `column "category" of relation
  "conventions" already exists` from a freshly generated, UNCOMMITTED
  `0013_famous_the_anarchist.sql` — the live `conventions` table already had
  `category`/`status` (with the wrong default, `'accepted'` not the
  schema's `'pending'`) from old leftover history, but was missing
  `accepted`/`extraction_run_id`/`created_at` that the schema actually wants.
  Diagnose the same way each time: `shasum -a 256
  server/src/db/migrations/*.sql` vs `select hash from
  drizzle.__drizzle_migrations` in the container; for any file whose hash is
  missing, `\d <table>` to see which of its columns are already there vs
  genuinely missing, apply only the missing ones (`ADD COLUMN IF NOT EXISTS`,
  fix defaults with `ALTER COLUMN ... SET DEFAULT`), then insert the file's
  real hash into `drizzle.__drizzle_migrations` so it isn't retried. Treat any
  freshly-generated, `git status`-untracked migration file as suspect for this
  exact failure mode before assuming it's a clean apply.

- **2026-08-15** — `duplicate key value violates unique constraint
  "agent_skills_agent_id_skill_id_pk"` on skill drag-reorder had TWO causes, fix
  BOTH: (1) `AgentsRepository.setSkills` did a bare delete-then-insert — two
  overlapping `POST /agents/:id/skills` interleave and the second insert collides;
  wrap the delete+insert in `this.db.transaction(...)` and `[...new Set(skillIds)]`
  to dedupe (a repeated id in one payload hits the same PK). (2) `SkillsTab`
  persisted on BOTH `onDrop` and `onDragEnd`, so one drag fired two concurrent
  writes; persist ONCE (on `dragend`; `dragover` already reorders live, `drop` just
  `preventDefault`s). `server/src/modules/agents/repository.ts` (setSkills),
  `client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/SkillsTab.tsx`

## Open Questions

- **2026-08-16** — `server/src/modules/conventions/` (the whole module, not just
  one file) is **untracked in git** (`git status --short` shows `?? src/modules/
  conventions/`), even though it's a real, working feature with its own schema
  table, repository, and `.it.test.ts` — not scratch/WIP debris. Confirm with
  whoever owns it whether this is intentional (e.g. deliberately kept local
  during dev) before anyone runs `git clean` or checks out a fresh worktree —
  either would silently delete it, migration fix included.
