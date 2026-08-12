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

_None yet._

## What Doesn't Work

_None yet._

## Codebase Patterns

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

_None yet._

## Recurring Errors & Fixes

_None yet._

## Open Questions

_None yet._
