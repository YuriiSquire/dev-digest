# Insights — client

UI decisions and dead ends. Read before restructuring pages, state, or the data
layer.

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
  `src/path/to/file.tsx:42`
```

Roughly 5 entries per section. Promote stable entries into `docs/` and delete
them here.

---

## Decisions

_None yet. Add the first one the next time a UI approach is tried and
abandoned — that is exactly what this file is for._

## What Works

_None yet._

## What Doesn't Work

_None yet._

## Codebase Patterns

- **2026-08-12** — A popover rendered inside a PR-list cell is clipped by the
  list card's `overflow: hidden`. The FINDINGS-column dropdown (`PRFindingsCell`)
  only becomes visible once `s.tableCard.overflow` is flipped to `"visible"`
  (`client/src/app/repos/[repoId]/pulls/styles.ts:94`). Trade-off: the card then
  no longer clips child row borders to its rounded corners — re-check the row
  corners after changing it. The cell's severity chips are `<button>`s: clicking
  one opens the dropdown filtered to THAT severity (click the active chip again /
  Escape / an outside `mousedown` closes it); the row wrapper `stopPropagation`s
  so clicking a chip doesn't trigger the row's navigate-on-click. Filtering runs
  over the already-cached `usePrReviews` payload in memory — switching severities
  does NOT refetch.
  `client/src/app/repos/[repoId]/pulls/_components/PRFindingsCell/PRFindingsCell.tsx`

- **2026-08-04** — Before adding a new hook/endpoint to show "more detail on
  X" in a component, check whether the detail is already fetched elsewhere on
  the same page and can be threaded down as a prop instead. `RunHistory` only
  ever received `RunSummary[]` (denormalized `critical_count`/`warning_count`/
  `suggestion_count`, no finding detail), but `FindingsTab` — its direct
  parent — already holds the full `ReviewRecord[]` (each with a `findings:
  FindingRecord[]` and `run_id`) via `usePrReviews`. Adding a hover preview of
  a run's findings needed only `new Map(runs.map(r => [r.run_id,
  r.findings]))` in `FindingsTab` passed down as `findingsByRun`, zero new
  API/hook. `client/src/app/repos/[repoId]/pulls/[number]/_components/FindingsTab/FindingsTab.tsx:75`

## Tool & Library Notes

- **2026-08-12** — Supersedes the seed claim in the 2026-08-04 note below: the
  seed CHANGED. The active seeded repo is now
  `squire-technologies/squire-mobile-commander` (old `acme/payments-api` still
  exists but is findings-free; `myasoid/dev-digest` + `quarkusio/quarkus` are
  gone). It carries ~8 completed `agent_runs` with `findings_count > 0` and
  non-null `critical/warning/suggestion_count`, so findings UI (PR-list FINDINGS
  column + hover dropdown) renders against REAL seed data — no row injection
  needed. Note `psql` is not on the host PATH; query via the container:
  `docker exec $(docker ps --filter publish=5432 -q) psql -U devdigest -d devdigest -tAc "select r.full_name, count(*) filter (where ar.findings_count>0) from repos r join pull_requests pr on pr.repo_id=r.id join agent_runs ar on ar.pr_id=pr.id and ar.status='done' group by 1"`.
  The injection recipe + playwright fallback below still apply (chromium build
  mismatch reconfirmed: cached 1228 vs required 1234 → rerun `npx playwright
  install chromium`).

- **2026-08-04** — This dev environment's seeded Postgres has zero
  `agent_runs` rows with `findings_count > 0` across all 3 seeded repos
  (`acme/payments-api`, `myasoid/dev-digest`, `quarkusio/quarkus`) — every
  seeded review is a clean 0-findings/100-score run. To visually verify any
  findings-related UI change, either trigger a real (costly) LLM review run,
  or temporarily `INSERT` rows into `findings` + bump the matching
  `agent_runs.critical_count`/`warning_count`/`suggestion_count`/
  `findings_count`, screenshot, then delete/revert immediately after —
  confirmed safe and fully reversible on the local dev DB
  (`postgres://devdigest:devdigest@localhost:5432/devdigest`). Separately, no
  `chromium-cli` or `agent-browser` CLI was present in this sandbox; `npx
  playwright install chromium` (no `--with-deps`, which needs sudo) downloads
  a working headless Chromium fine, so a scratch `npm install playwright` +
  a small driver script is the fallback for one-off browser verification here.

## Recurring Errors & Fixes

- **2026-08-12** — Asserting content from a **lazily-fetched** dropdown (a data
  hook mounted only once the popover opens) that opens on a `setTimeout` HOVER
  delay needs BOTH timer modes: open under `vi.useFakeTimers()` +
  `act(() => vi.advanceTimersByTime(150))` (the hover delay), then switch back to
  `vi.useRealTimers()` **before** `await findBy*` / `waitFor`, so the TanStack
  Query promise can settle and RTL can poll for the resolved content. Fake timers
  alone flip `aria-expanded` but never resolve the fetch, so the detail never
  appears. Restore real timers + `vi.unstubAllGlobals()` in a `finally`.
  **Corrected 2026-08-12:** `PRFindingsCell` moved to a CLICK trigger (no
  open-delay), so its test now just does `fireEvent.click` + `await findBy*`
  under real timers — no fake timers. This pattern now applies only to the
  hover-delayed timeline chips.
  `client/src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.test.tsx`

- **2026-08-04** — `fireEvent.mouseEnter` on a component whose hover-open
  logic uses `setTimeout` (e.g. an open delay to survive a mouse
  pass-through) needs `vi.useFakeTimers()` **and** the timer advance wrapped
  in `act()` from `@testing-library/react`:
  `act(() => { vi.advanceTimersByTime(150); })`. Without the `act()` wrapper,
  the state update from the timer callback doesn't flush before the
  assertion runs — `aria-expanded` stays `"false"` and the popover content is
  never found, even though the component logic is correct.
  `client/src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.test.tsx`

- **2026-08-01** — A vitest failure whose two sides look identical —
  `expected '9 119 tok' to be '9 119 tok'` — is a look-alike Unicode space, not
  an environment difference. `formatTokenCount` had a literal THIN SPACE
  (U+2009) typed into `.replace(/,/g, " ")`, invisible in the diff and in the
  test output. Dump code points first —
  `[...s].map((c) => c.charCodeAt(0).toString(16))` — before theorising about
  ICU or jsdom locale data, which is where this was initially misdiagnosed.
  Group digits with `.replace(/\B(?=(\d{3})+(?!\d))/g, " ")` rather than
  `toLocaleString` plus a separator swap, so the separator is a plain U+0020 a
  test can type. Find strays with `rg '\x{2009}' src/`.
  `client/src/lib/format.ts:40`

## Open Questions

_None yet._
