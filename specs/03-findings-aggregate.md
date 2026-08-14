# PR-list findings — aggregate across all review agents

**Status:** shipped
**Packages touched:** server, `@devdigest/shared`, client

## Problem

The PR list is a triage surface — "where do I look first?" Its FINDINGS column
showed the per-severity counts of only the **single latest completed run**, i.e.
whichever one agent finished last. That hides every other agent's findings: if
Security found 2 criticals but Performance finished last, the list shows
Performance's counts and those criticals are invisible until you open the PR —
misleading in the one direction that matters (it can hide blockers).

## Scope — in / out

**In:** the FINDINGS column's counts and its hover card.
**Out (unchanged):** COST stays the single latest completed run's cost; SCORE
stays the latest review's score — a deliberate asymmetry (findings = "what do all
agents find", cost = "what does the latest review cost"). No cross-agent dedup;
no head/commit scoping; no new `multi_agent_runs`/`Conflict`/Compose feature.

## What it does

- **Counts** = the **sum** of each agent's **latest completed run's** per-severity
  counts. Summed, **not deduped**: two agents flagging the same file:line count
  twice (there is no finding fingerprint in the schema — dedup would be fuzzy and
  net-new). The hover makes overlap transparent by attributing per agent.
- **Hover** = one section **per agent** (agent name + its severity chips + its
  findings), mirroring the PR-detail Agent-runs timeline.

## Contract changes

No shape change. `PrMeta.critical_count / warning_count / suggestion_count`
(`@devdigest/shared` `contracts/platform.ts`, both server + client copies) keep
their type; only their documented meaning changes to "aggregate sum across each
agent's latest completed run; nullish until a run completes."

## Implementation

- **Server** — `server/src/modules/pulls/routes.ts` (`GET /repos/:id/pulls`): one
  IN-query over `status='done'` runs, `ranAt desc`. Cost = first-seen run per PR.
  Findings = sum of `critical/warning/suggestion_count` over the **latest run per
  `(pr, agent)`** (`seenAgent` Set keyed `` `${prId}:${agentId ?? runId}` ``, so
  deleted-agent runs don't collapse). PR with no done runs → null counts.
  Aggregates the **denormalized per-run counters**, never a JOIN over `findings`
  (per `server/INSIGHTS.md` 2026-08-04).
- **Client** — `PRFindingsCell` badge cell unchanged (reads the now-aggregate
  `PrMeta` counts). Its hover `FindingsDropdown` groups the PR's reviews by agent
  (`groupByAgentLatest`: each agent's latest `kind==='review'` with findings) and
  renders the new `FindingsByAgentCard`
  (`client/src/components/findings-hover-card/`). A shared `FindingRow` was
  extracted so the by-agent card and the timeline's flat `FindingsHoverCard`
  render rows identically. i18n key `list.findingsByAgentTitle`.

## Acceptance criteria

- List counts equal the sum of each agent's latest-run counts (verified live:
  PR #1362 → warn 3 = 1+2 across agents, not any single run's warn=1).
- Cost/score unchanged (single latest run / latest review).
- Hover shows one section per contributing agent.
- No dedup, no per-commit scoping (see below).

## Open questions / deferred

- **Head-staleness scoping:** runs carry no commit ref, so an agent that ran on
  an older commit still contributes (same staleness the single-run version had).
  Future option: filter runs to `ranAt >= head commit's committed_at` via
  `pr_commits`.
- **Real dedup:** needs a finding fingerprint (file+line+rule); would unlock the
  already-defined-but-unimplemented `Conflict`/`MultiAgentRun` contracts.
