# Insights — cross-package

Decisions that span more than one package, and things we tried that did not
work. Module-local lessons go in `<module>/INSIGHTS.md` instead.

Read at the start of a task, written at the end of one, by the
`engineering-insights` skill. Sections are fixed — add to the one that fits,
newest first. Every entry must be actionable cold: claim first, `path:line` or a
runnable command last. If it would be obvious to anyone reading the code, leave
it out.

Roughly 5 entries per section. When an entry becomes stable reference material,
move it into `docs/` and delete it here.

---

## Decisions

### 2026-08-15 — Skill usage stats are attributed at RUN level, not per finding

**What:** `SkillStats` (pull_frequency / accept_rate / findings-by-category) is
computed from a new `run_skills(run_id, skill_id)` join that `run-executor.ts`
writes when it resolves an agent's *enabled* linked skills — i.e. "this skill was
in the run's prompt", association not causation. A finding still maps only to
`reviews.runId`; there is deliberately NO `skillId` on findings. Rates return
null (UI renders "—") when the denominator is 0, never a fabricated 0.
`server/src/db/schema/runs.ts` (run_skills), `server/src/modules/skills/repository.ts` (`stats()`).
**Why:** a review's findings come from the whole assembled prompt — you cannot
honestly attribute one finding to one skill. Note the Skills domain was already
~60% scaffolded (tables `skills`/`skill_versions`/`agent_skills`, the
`@devdigest/shared` contracts, the `## Skills / rules` prompt slot, the
`PromptAssembly.skills` trace field, agent-side link routes, and the full client
i18n) — when adding a "lesson" feature, grep `db/schema.ts` + `contracts/` +
`messages/` FIRST; the scaffolding is usually there and only the CRUD module +
wiring + UI are missing.
**Rejected:** adding `skillId` to `findings` for per-skill accept-rate
(unfalsifiable causation + a heavier migration); and fabricating pull/accept
numbers to fill the Stats tiles.

### 2026-08-11 — CLAUDE.md is a map-not-docs delta over root, by example

**What:** every per-package `CLAUDE.md` follows one skeleton (`Commands` /
`Conventions` / `Gotchas` / `Read when`) and is a *delta* over root — root
always loads, so modules never repeat the stack, the pnpm/npm split, or the
global do-not-touch. Docs are reached only through CONDITIONAL `condition →
` + "`path`" triggers in a mandatory `Read when` block that links all doc types
present (README/docs/specs/INSIGHTS); `@import` is banned (it would eager-load
full docs every session). Nested `server/src/modules/repo-intel/CLAUDE.md`
auto-loads on touch and records findings into `server/INSIGHTS.md` (it has none
of its own).
**Why:** a bloated `CLAUDE.md` drowns rules in noise ("context rot"); the file
loads every session, so it must point, not duplicate.
**Rejected:** a `docs/claude-md-convention.md` template — the convention lives
by example in the six existing files instead, so there is no second source to
drift. Also rejected dropping `e2e/docs/` for tree symmetry: `e2e/specs/` holds
executable `*.flow.json`, so prose specs have nowhere else to live.

### 2026-07-31 — Standalone packages instead of a workspace

**What:** four packages, each with its own `package.json` and lockfile; sharing
happens through tsconfig path aliases, not published modules. Each suite is
gated by its own CI workflow with a path filter.
**Why:** _rationale not recorded anywhere in the repo — fill this in._ Do not
"fix" this into a workspace before that gap is closed; it is load-bearing for the
per-package CI path filters.

### 2026-07-31 — Zod contracts as the single source of truth

**What:** `@devdigest/shared` schemas drive request validation, response
serialization, and client-side types.
**Why:** one definition, no drift between server and client.
**Rejected:** hand-rolled `Schema.parse(req.body)` inside handlers — it validated
input but left responses unchecked, so contract drift surfaced in the browser.

## What Works

- **2026-08-16** — To drive an LLM-backed feature through the hermetic e2e browser
  suite (which boots key-free + read-only, so any real provider call 500s), gate a
  fixture injection on an env flag in `buildApp`: when `process.env.E2E_FIXTURES
  === '1'`, `overrides = { ...e2eFixtureOverrides(), ...opts.overrides }` (explicit
  test overrides still win — spread last). `e2eFixtureOverrides()`
  (`server/src/platform/e2e-fixtures.ts`) returns a `MockLLMProvider` keyed by
  `structuredBySchema[<schemaName>]` + a `MockGitClient({ files })`; set the flag in
  `scripts/e2e.sh` (overridable: `export E2E_FIXTURES="${E2E_FIXTURES-1}"`) and the
  CI env (`.github/workflows/e2e-web.yml`). Keep it STRICTLY behind the flag — it
  imports `adapters/mocks.ts` into the boot path but never runs otherwise. Note the
  injection is GLOBAL (whole container), so scope fixtures to the feature under test
  and don't rely on the real git/LLM in the same run. Used for the Conventions
  Extractor "Re-scan": `server/src/app.ts`, `e2e/specs/09-conventions.flow.json`.

- **2026-08-14** — When building research-backed docs/skills from subagent web
  research, spot-check claim→source FIDELITY by re-fetching the cited pages — not
  just that the URLs resolve. A URL-reachability pass (`curl -sI`, 30/31 `200`) on
  the new `.claude/skills/frontend-architecture` skill was clean, yet re-reading
  sources against each claim caught a real misattribution: guidance credited to
  Kent C. Dodds's "When to Break Up a Component" that the article does not make.
  Method that worked: fan out one verify-agent per source, each returning
  SUPPORTED / PARTIAL / NOT FOUND per claim with a supporting quote.
  `.claude/skills/frontend-architecture/README.md`

## What Doesn't Work

_None yet._

## Codebase Patterns

- **2026-08-16** — The per-feature model registry `FEATURE_MODELS` has **THREE**
  in-sync copies, not the usual two: `server/src/vendor/shared/contracts/platform.ts`
  (source of truth), `client/src/vendor/shared/contracts/platform.ts`, AND
  `client/src/lib/feature-models.ts`. The third exists because it's a runtime
  VALUE, not just a type — the client can only import TYPES from vendored shared
  (importing the value pulls `vendor/shared/index.ts` into the webpack bundle,
  whose `./contracts/*.js` re-exports Next can't resolve), so the Settings UI
  reads its own local mirror. Changing a feature's default provider/model (e.g.
  `conventions` → `openrouter`/`deepseek/deepseek-v4-flash`) means editing all
  three; miss the client-lib copy and Settings → Feature Models silently shows the
  stale default. `client/src/lib/feature-models.ts:1-12` (comment explains why).

- **2026-08-14** — `feat/*` branches fork from **`develop`, not `main`** — this repo
  is GitFlow, which contradicts root `CLAUDE.md` ("Main branch (you will usually use
  this for PRs): main"). So any tool that diffs "the PR" must resolve the base
  dynamically, not hard-code `main`: nearest-ancestor wins. Measured on `feat/lab02`:
  `git rev-list --count develop..HEAD` = 3 vs `main..HEAD` = 14, so `develop` is the
  real base. The `pr-self-review` skill resolves it as: existing PR's
  `gh pr view --json baseRefName` → else min `rev-list --count <cand>..HEAD` over
  {develop, main} → else `origin/HEAD`. `.claude/skills/pr-self-review/SKILL.md` (Step 0)

- **2026-08-14** — The backend already implements onion / ports-and-adapters /
  clean architecture in full — it is just never *named*: a grep for
  `onion|hexagonal|ports.?and.?adapters|clean architecture` across the repo
  returns nothing, so you cannot find the pattern by searching for the concept.
  The rings: ports (interfaces) in `server/src/vendor/shared/adapters.ts`,
  adapters in `server/src/adapters/*`, DI composition root in
  `server/src/platform/container.ts` (lazy getters typed by the port, returning
  the test override else the concrete impl), layered modules
  `routes.ts → service.ts → repository.ts` (repository = the only Drizzle layer),
  and the pure DI engine `reviewer-core/` (deps injected via `ReviewInput`, no
  I/O). Nuance: full port/adapter inversion is applied to *external* systems
  (LLM/GitHub/git/…) only; repositories are concrete classes injected with `Db`,
  and the one module-level facade *interface* is `RepoIntel`
  (`server/src/modules/repo-intel/types.ts`). Before "adding" clean architecture
  or refactoring toward ports/adapters, read the `onion-architecture` skill
  (`.claude/skills/onion-architecture/`) — it names and enforces the existing
  pattern rather than introducing a new one.

- **2026-08-12** — `server/src/db/seed.ts` (the demo seed) is SHARED across two
  suites: 8 server `*.it.test.ts` files import and run `seed()`, and the `e2e`
  hermetic suite seeds from it too. So editing the demo seed is load-bearing for
  both — after ANY change, run the DB-backed suite (`cd server && pnpm exec
  vitest run .it.test`, needs Docker/testcontainers). `pnpm typecheck` and the
  hermetic units (`--exclude '**/*.it.test.ts'`) will NOT catch a seeded-data
  assertion the change breaks. Confirmed safe to extend idempotently (guard the
  block by PR number, unique title so e2e flows keyed on other PRs don't shift):
  adding a demo PR left all 34 it-tests green. `server/src/db/seed.ts`

- **2026-08-04** — `server/src/vendor/shared/contracts/*.ts` and
  `client/src/vendor/shared/contracts/*.ts` are two independent files with no
  sync script between them — a schema change must be hand-edited in both
  (server first, per `CLAUDE.md`). Confirmed by a pre-existing comment-only
  diff between the two `trace.ts` copies before this session touched either.
  Forgetting the client copy compiles fine locally (client typecheck only sees
  its own copy) and fails invisibly until the two drift on a real field.
  `server/src/vendor/shared/contracts/trace.ts` /
  `client/src/vendor/shared/contracts/trace.ts`

- **2026-08-12** — Per-run LLM cost is wired end-to-end AND surfaced in the UI on
  all three review surfaces: the PR-list COST column (`PrMeta.cost_usd` = the
  latest *completed* run's cost, deliberately not a sum), the PR-detail
  Agent-runs timeline ("N tok · $X"), and the run trace drawer's COST stat tile.
  Computing it costs **zero extra model calls**: every provider returns `costUsd`,
  and for OpenRouter it is the REAL billed figure — the request sets
  `usage: { include: true }` and reads `usage.cost`, falling back to the injected
  `PriceBook` estimator; `reviewPullRequest` sums it across map-reduce chunks onto
  `ReviewOutcome.costUsd`, and the server persists it to `agent_runs.cost_usd` at
  completion. Rule everywhere: a null cost (unpriced model, or a run that never
  reached the model) renders "—", never "$0.00". History — it was removed in
  `d45ab0d` (+ `58c6ac7`) then re-added across every surface in `d186657`, so any
  earlier version of this note claiming the column/feature was dropped is
  obsolete. `server/src/db/schema/runs.ts:26`,
  `client/src/components/run-cost-badge/RunCostBadge.tsx`, spec `specs/01-run-cost.md`

## Tool & Library Notes

- **2026-08-14** — A skill that wants to fan work out to subagents CANNOT tell them
  to "invoke skill X": a subagent gets no skill-catalog system-reminder, so it has
  no sanctioned way to call the Skill tool. Have the subagent **`Read` the target
  `SKILL.md` (+ its `references/`) by absolute path** instead — every agent type has
  `Read`. Also pick the agent type deliberately: `Explore` is a read-only *locator*
  that reads excerpts and is documented NOT to audit, so it can't do a judged,
  full-diff lens review — use `general-purpose` for that. Both learned building
  `pr-self-review`'s Step 4. `.claude/skills/pr-self-review/SKILL.md`

- **2026-08-14** — `.claude/skills/README.md` (line 3) claims skills are mirrored
  to Cursor via a `.cursor/skills → ../.claude/skills` symlink, but **that symlink
  does not exist** — there is no `.cursor/` directory in the repo at all (control
  test: even `frontend-architecture` is unreachable through it). So skills are
  discoverable only at the canonical `.claude/skills/` path; do not rely on the
  documented Cursor mirror. To actually honor the doc:
  `ln -s ../.claude/skills .cursor/skills` (needs `.cursor/` created first).
  `.claude/skills/README.md:3`

## Recurring Errors & Fixes

- **2026-08-15** — `gh pr create` fails here with a misleading `No commits between
  develop and <branch> / Head ref must be a branch / Base/Head sha can't be blank`
  because **git `origin` and the `gh` default repo differ**: `origin` is the fork
  `YuriiSquire/dev-digest` (where feature branches + `develop` live and get pushed),
  but `gh` defaults to `upstream` `ai-agentic-engineering-neo/dev-digest` (which has
  no reachable `develop`). Fix: target the fork explicitly —
  `gh pr create --repo YuriiSquire/dev-digest --base develop --head <branch>` (or
  `gh repo set-default YuriiSquire/dev-digest` once). Confirm intent before ever
  aiming a PR at the `upstream` org — that is an outward-facing action. `git remote -v`

## Open Questions

_None yet._
