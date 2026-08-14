# Severity signs on the PR pages

**Status:** draft
**Packages touched:** server, `@devdigest/shared`, client

## Problem

Reviewer agents produce findings at three severities — **CRITICAL / WARNING /
SUGGESTION**. Today that breakdown is only visible after opening a single PR's
**Agent runs** tab. On the PR **list**, a reviewer sees a score ring but no
signal about _what_ is wrong, so a PR with two critical exposures looks the same
at a glance as one with two style nits. The queue can't be triaged without
clicking into each PR.

Add severity "signs" (icon + count chips, e.g. `⛔ 2 · ⚠ 2 · 💡 2`) to the PR
list, with a hover dropdown that reveals each finding's details — mirroring the
treatment the PR-detail timeline already has.

### Already built — do not rebuild

The **PR detail → Agent runs** tab is fully implemented and matches the target
design:

- `RunHistory.tsx` → `SeverityFindings` renders per-run CRITICAL/WARNING/
  SUGGESTION chips under the reviewer name, from the run's denormalized counts.
- Hovering the chip cluster opens `RunFindingsHoverCard.tsx` — the "N FINDINGS
  IN THIS RUN" popover (per-finding severity, title, category, `file:line`,
  confidence, rationale), reusing already-loaded review data (no per-hover
  fetch).

So the detail surface needs only a **light visual-alignment pass**, not new
behavior. The real build is the **PR-list column**.

## Scope — in / out

**In**

- **PR list** — a FINDINGS column between SCORE and STATUS, showing one
  `SeverityBadge` per non-zero severity (CRITICAL→WARNING→SUGGESTION order) from
  the PR's latest completed run. `—` (muted) when the PR was never reviewed.
- **PR list — hover dropdown.** Hovering the findings cell (150 ms delay; also
  `onFocus`/`onBlur` + Escape for a11y) opens a dropdown listing **all** the
  latest review's findings, sorted by severity then confidence — reusing the
  same card as the detail timeline. Details are **lazy-loaded on hover** via the
  existing `GET /pulls/:id/reviews`, so the list payload stays light.
- **PR detail** — a visual-alignment pass on the existing timeline chips +
  hover card against the target design (spacing/labels only).

**Out**

- Per-severity **filtering** or click-navigation from the counts — the counts
  are non-interactive labels; the dropdown always shows all findings.
- A new server endpoint (list counts ride the existing list query; hover details
  reuse `/pulls/:id/reviews`).
- Any change to how findings are produced, scored, or persisted.
- Cross-run aggregation — like the score/cost columns, the list reflects the
  **latest completed run**, not a sum across runs.

## Contract changes

`@devdigest/shared` first, in **both** hand-synced copies (server then client —
`server/` + `client/src/vendor/shared/contracts/platform.ts`):

- Extend `PrMeta` (list item) with per-severity counts, mirroring `cost_usd`:
  ```ts
  critical_count: z.number().int().nullish(),
  warning_count: z.number().int().nullish(),
  suggestion_count: z.number().int().nullish(),
  ```
  **nullish** (not 0) when the PR has never been reviewed, or on rows from before
  the field existed — consistent with `score` / `cost_usd`.

No other contract changes: `Severity`, `Finding`/`FindingRecord`, `ReviewRecord`,
and the per-run `RunSummary.{critical,warning,suggestion}_count` all already
exist.

## How it will be implemented (reference)

- **Read (server).** `GET /repos/:id/pulls`
  (`server/src/modules/pulls/routes.ts`) already selects the latest `status='done'`
  run per PR for the cost column. Extend that **same** query to also select
  `criticalCount / warningCount / suggestionCount` (denormalized on `agent_runs`,
  `server/src/db/schema/runs.ts`) and emit them on each `PrMeta`. Zero new
  queries. Update the stale comment that says the breakdown is intentionally
  omitted from the list.
- **Render — chips (client).** New
  `pulls/_components/PRFindingsCell/` renders `SeverityBadge`
  (`vendor/ui/primitives/Badge.tsx`, `compact` + `count`) from the `PrMeta`
  counts. Insert `"findings"` into `COLUMN_KEYS` and add a matching track to
  `GRID` in `pulls/constants.ts` (both plus `PRRow`'s cells stay in lockstep);
  add the cell to `PRRow.tsx`. Column label in `messages/en/prReview.json`.
- **Render — dropdown (client).** On hover, `PRFindingsCell` lazy-loads details
  via `usePrReviews(pr.id)` (`client/src/lib/hooks/reviews.ts`; query fires only
  once hovered) and renders the shared findings card with the newest
  `kind:'review'` review's findings, passing the repo full-name (from
  `useActiveRepo`) and `pr.head_sha` for GitHub `file:line` deep-links. Small
  loading state while the fetch is in flight.
- **Reuse — shared card.** Promote
  `pulls/[number]/_components/RunHistory/RunFindingsHoverCard.tsx` to a shared
  `client/src/components/findings-hover-card/` (same convention as
  `components/run-cost-badge`), keeping its props (`findings`, `repoFullName`,
  `headSha`, optional `onSelect`). Both the timeline and the list import it — one
  card, two surfaces. The 150 ms hover-delay pattern is already proven in
  `RunHistory.tsx`.

## Acceptance criteria

- A reviewed PR's list row shows a `SeverityBadge` per non-zero severity, in
  CRITICAL→WARNING→SUGGESTION order, matching the counts on its latest completed
  run. A never-reviewed PR renders `—`, never empty or `0`.
- Hovering the findings cell opens a dropdown listing that PR's latest review's
  findings, severity-sorted, with title, category, `file:line`, confidence and
  rationale — identical card to the detail-page timeline hover.
- Dropdown details are fetched only on hover (no findings in the list payload);
  the counts themselves are non-interactive.
- The list's counts reflect the **latest completed run**, not a sum.
- The detail-page timeline chips + hover behavior are unchanged aside from the
  visual pass; `RunHistory.test.tsx` stays green.
- `PrMeta` change verified by `server/test/contracts.test.ts`; new
  `PRFindingsCell.test.tsx` covers the chips, the `—` empty state, and the
  hover-open (fake-timers + `act()`, per client INSIGHTS).

## Open questions

- The list's counts come from the latest `done` **run** (denormalized, cheap),
  while `score` comes from the latest **review** row and the hover shows the
  latest review's **findings**. These are normally the same run; if a later run
  diverges, count-vs-detail could momentarily disagree. Acceptable, and it
  mirrors the existing score-vs-cost split — flagged in case we later want to key
  all three off one source.
- Column width / whether to collapse to a single "N findings" chip on narrow
  viewports — deferred to implementation against the live layout.
