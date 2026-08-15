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

_None yet._

## Codebase Patterns

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

_None yet._
