# Run cost (USD) across review surfaces

**Status:** shipped
**Packages touched:** reviewer-core, server, `@devdigest/shared`, client

## Problem

A reviewer agent run has a real dollar cost. Users need to see it — both to
compare models/agents and to answer "what does reviewing this PR cost?" — without
the app making any extra model calls to find out. The token usage that determines
cost already comes back in the LLM response, so cost must be derived from data we
already have, never a second request or a separate pricing lookup at read time.

## Scope — in / out

**In**
- **PR list** — a COST column showing the cost of the PR's latest *completed*
  run, compact ("$0.014").
- **PR detail → Agent runs timeline** — tokens + cost per run next to the
  timestamp ("9 119 tok · $0.0013").
- **Run trace drawer** — a COST tile in the Stats grid alongside DURATION /
  TOKENS / FINDINGS ("$0.06").

**Out**
- Per-PR cost *sums* / totals across runs (the list shows the latest run only).
- Budgets, spend caps, alerting.
- Historical cost charts and per-agent/per-model rollups — those already live in
  the Agent Performance contracts (`contracts/productionize.ts`,
  `contracts/observability.ts`) and are a separate surface.

## Contract changes

`@devdigest/shared` first (already present):
- `PrMeta.cost_usd: number | nullish` — the list item's per-PR cost
  (`contracts/platform.ts`; "latest completed run, not a sum").
- `RunSummary.cost_usd`, `.tokens_in`, `.tokens_out` — per-run history row
  (`contracts/trace.ts`).
- `RunStats.cost_usd`, `.tokens_in`, `.tokens_out` — the trace `stats` block
  (`contracts/trace.ts`).

Every `cost_usd` is `number | null`: **null** (not 0) when the model is unpriced
or the run never reached the model.

## How it is implemented (reference)

- **Compute** (engine, zero extra calls): `reviewer-core/src/llm/openrouter.ts`
  sends `usage: { include: true }` and reads `usage.{prompt_tokens,
  completion_tokens,cost}`; cost precedence is OpenRouter's real `usage.cost` →
  injected `estimateCost` (`PriceBook`) → null.
  `reviewer-core/src/review/run.ts` accumulates tokens and sums cost across
  map-reduce chunks onto `ReviewOutcome` (null-poisoning: any unpriced chunk →
  null run cost).
- **Price** (server, injected so the engine stays pure): static table
  `server/src/adapters/llm/pricing.ts` + live OpenRouter prices in
  `server/src/platform/price-book.ts`, wired in `server/src/platform/container.ts`.
- **Persist**: `server/src/modules/reviews/run-executor.ts` writes
  `tokens_in`/`tokens_out`/`cost_usd` onto the `agent_runs` row at completion
  (`server/src/db/schema/runs.ts`), mirrored into the trace jsonb `stats`.
- **Read**: `GET /repos/:id/pulls` rolls up `PrMeta.cost_usd` = latest
  `status='done'` run (`server/src/modules/pulls/routes.ts`); `GET /pulls/:id/runs`
  → `RunSummary[]`; `GET /runs/:id/trace` → `RunTrace.stats`
  (`server/src/modules/reviews/routes.ts`).
- **Render**: shared `client/src/components/run-cost-badge/RunCostBadge.tsx`
  (`compact` + `withTokens` variants) and formatters `formatCostUsd` /
  `formatTokenCount` in `client/src/lib/format.ts`. Call sites: list column
  `pulls/_components/PRRow/PRRow.tsx`; timeline
  `pulls/[number]/_components/RunHistory/RunHistory.tsx`; drawer
  `.../RunTraceDrawer/_components/TraceBody/TraceBody.tsx`.

## Acceptance criteria

- Every completed run shows a cost readout on all three surfaces.
- A run with no cost data renders "—", never "$0.00" (`$0.00` is reserved for a
  genuinely free model). Verified by `format.test.ts` and `RunCostBadge.test.tsx`.
- Cost is derived from `usage` already in the LLM response — **zero additional
  model calls** and no read-time pricing lookup.
- The list's per-PR cost is the latest completed run's cost, not a sum.

## Open questions

- The drawer's token readout uses a local `formatTokens` ("12k→1.5k",
  `RunTraceDrawer/helpers.ts`) showing in→out, while the timeline/badge use
  space-grouped `formatTokenCount` showing the total. Intentional (in→out detail
  vs. compact total) or worth unifying? Left as-is for now.
