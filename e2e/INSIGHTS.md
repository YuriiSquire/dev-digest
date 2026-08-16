# Insights — e2e

Decisions about the browser suite and dead ends. Read before adding a flow or
"fixing" a flaky one.

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
  `specs/NN-name.flow.json`
```

Roughly 5 entries per section. Promote stable entries into `docs/` and delete
them here.

---

## Decisions

### 2026-07-31 — Hermetic runner instead of resetting the dev DB

**What:** `npm run e2e:hermetic` boots an isolated, freshly-seeded stack on
alternate ports (Postgres :5433, API :3101, web :3100).
**Why:** flows assume exactly one seeded repo — flow `02` follows the home
redirect to the *first* repo — so a dev DB with other imported repos fails
02/04/05.
**Rejected:** `docker compose down -v` to reset the dev DB. It deletes the
`devdigest_pgdata` volume along with every real repo and review you imported.

### 2026-07-31 — Deterministic locators, no AI commands

**What:** flows use only `--url`, `--text`, and `find role|text|label`, against
read-only seeded data.
**Why:** the suite must run in CI with no API key and produce identical results
every time.
**Rejected:** agent-browser's `chat` command — convenient, but it makes runs
non-reproducible and requires a key.

## What Works

_None yet._

## What Doesn't Work

- **2026-08-16** — In the HERMETIC suite, flows `04`/`05` intermittently fail at
  their shared step `find text "Add rate limiting to public API endpoints" click`
  (the PR-title link): agent-browser's `find text` misses text React splits across
  nested styled spans, so the click is nondeterministic — one run fails `04` while
  `05` passes, a re-run flips it. NOT a regression from your change (confirmed by
  toggling `E2E_FIXTURES` off/on: the failure floats between `04` and `05`
  regardless, and `09` is unaffected). This is distinct from the dev-DB multi-repo
  gotcha in `CLAUDE.md` — it reproduces on the freshly-seeded single-repo stack.
  Harden with `find role link --name` or `snapshot`+`@ref`.
  `e2e/specs/04-pr-findings.flow.json`, `e2e/specs/05-pr-diff.flow.json`

- **2026-08-15** — `08-pr-list-findings.flow.json` fails on this repo regardless
  of the working tree: its step `find role button hover --name "6 findings"`
  HOVERS the findings cell, but `PRFindingsCell` moved to a CLICK trigger (see
  client `INSIGHTS.md` 2026-08-12), so a hover never opens the dropdown and the
  flow stalls at that step (7/8). Confirmed pre-existing by `git stash -u`-ing all
  local changes and re-running — identical failure on the clean base, so it is NOT
  a regression from whatever you just changed. Fix: change that step's `"hover"`
  to `"click"`. `e2e/specs/08-pr-list-findings.flow.json:10`

## Codebase Patterns

- **2026-08-12** — the PR-list FINDINGS chips (`PRFindingsCell`) read the
  denormalized `critical_count`/`warning_count`/`suggestion_count` from the
  latest `status='done'` **`agent_runs`** row, not from a review's findings
  (`server/src/modules/pulls/routes.ts` ~L146). The hover dropdown separately
  lazy-fetches `GET /pulls/:id/reviews` and lists the newest `kind='review'`
  review's findings. So a seeded PR that must show chips *and* a hover needs
  **both**: a completed `agent_runs` row with counts **and** a `reviews` row
  (`kind='review'`) with matching `findings`. The base seed's PR #482 has only
  the review → its findings cell is a muted `—`. Seed PR #501 has both.
  `server/src/db/seed.ts`, `e2e/specs/08-pr-list-findings.flow.json`

## Tool & Library Notes

- **2026-08-16** — `@devdigest/ui` `Modal` scrolls its body in an INTERNAL
  `overflow-y:auto` container, so a tall modal (e.g. the create-skill modal) is
  clipped at the fold and `agent-browser screenshot` shows only the top —
  **`screenshot --full` does NOT help** (it expands the page, not the modal's own
  scroll region), and window `scroll down` doesn't move it either. To capture
  below-the-fold modal content, scroll a node INSIDE the modal into view first:
  `agent-browser eval "const e=[...document.querySelectorAll('*')].filter(x=>x.textContent?.includes('<unique text>')&&x.children.length<=2).pop(); e&&e.scrollIntoView({block:'center'}); 'ok'"`
  then `screenshot`. Burned several capture attempts before this; don't conclude a
  modal section is missing/unstyled from a cropped shot. Match a candidate by a
  UNIQUE substring (a FormField `<label>`'s text carries a trailing required `*`,
  so `textContent==='Skill body'` misses — use `includes`).

- **2026-08-15** — agent-browser pointer `click @ref` silently NO-OPS on a button
  inside a `Drawer`/`Modal` portal (the "Import skill" button): the click returns
  rc=0 but React's `onClick` never fires — the `@ref` goes stale after the button
  re-renders from disabled→enabled, and the portal/overlay can swallow the pointer.
  Symptom: no request in the API log despite a "successful" click. Fixes that
  worked: dispatch a real DOM click via `agent-browser eval "[...document
  .querySelectorAll('button')].find(b=>b.textContent.trim()==='Import skill')
  .click()"` (React's delegated listener catches it), or re-`snapshot` for a fresh
  ref immediately before each click. Same class of issue as native HTML5 drag:
  fire `dragstart`+`dragover`, let React re-render, THEN `drop` in a separate tick
  (a synchronous 3-event burst makes `onDrop` read the pre-render `orderIds`).

- **2026-08-15** — agent-browser `find text "<exact>"` (and `find text ... first`)
  MISSES text React splits across nested styled spans — e.g. a skill-card title
  reported "not found" for all 4 seeded skills while a `screenshot` showed them
  rendering fine. Don't conclude "the data didn't load" from a `find text` miss:
  verify render with `screenshot` + `get text <sel>`, and to *interact*, take a
  `snapshot` and click the element by its `@ref` (e.g. a card's enable `switch`
  came back as `ref=e22` → `agent-browser click @e22`; refs re-number after a
  re-render, so re-`snapshot` before the next click). Used to browser-verify the
  Skills pages against a live isolated stack (pg :5433 / api :3101 / web :3100).

- **2026-08-13** — agent-browser's native video recorder (`record start <p.webm>`
  … `record stop`) shells out to **ffmpeg** to encode; with no `ffmpeg` on PATH
  `record stop` fails `ffmpeg not found or failed to execute` and the clip is
  lost (frames are not buffered to disk). Worse, a failed `stop` leaves the
  recorder wedged: the next `record start` prints `Recording already active`
  yet captures nothing, so `stop` then reports `No frames captured`. Recovery is
  `record stop` **then** `close --all` to fully reset before recording again.
  Fix once with `brew install ffmpeg`. Output is VP8 `.webm` at the viewport
  size (headed run → ~10 fps). Not used by the flow runner; only for demos.
- **2026-08-13** — the PR-list findings severity chips are `<button>`s with an
  **`aria-label`** (`Show WARNING findings` etc.), not a `<label>` element, so
  `find label "Show WARNING findings"` fails `Element not found`. Use
  `find role button --name "Show WARNING findings"`. The popup groups by agent
  and headers as `N FINDINGS · M AGENTS` (uppercase — see the transform note
  below). `client/src/app/repos/[repoId]/pulls/_components/PRFindingsCell/`
- **2026-08-12** — agent-browser `wait --text` / `find text` match the
  **CSS-rendered** text, so `text-transform: uppercase` defeats a lowercase
  query: the FindingsHoverCard header renders "6 FINDINGS", and
  `wait --text "6 findings"` hangs until timeout while `wait --text "6 FINDINGS"`
  passes. Assert the *uppercased* form for any transformed element. Counter-note:
  it still matches the full **DOM** text through `text-overflow: ellipsis`
  truncation — a PR title visually clipped to "Cache prici…" is matched by its
  full string. `e2e/specs/08-pr-list-findings.flow.json`

## Recurring Errors & Fixes

_None yet._

## Open Questions

_None yet._
