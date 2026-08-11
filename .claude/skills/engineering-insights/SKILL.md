---
name: engineering-insights
description: >-
  Reads and records DevDigest's curated engineering insights. Use at the START of
  any task to read the INSIGHTS.md of the module the request concerns, and at the
  END of any non-trivial task to record what was learned back into that same
  file. Covers which module a finding belongs to, which section it goes in, the
  specificity bar an entry must clear, and the duplicate check that runs before
  writing. Triggers: "insights", "INSIGHTS.md", "wrap up", "what did we learn",
  "record this", "lesson learned", "session review", "retro", end of a session in
  which something non-obvious was discovered.
---

# engineering-insights

A two-half loop over the `INSIGHTS.md` files. **Read** at the start of a task,
**record** at the end. Insights are module-local by design: a session working in
`client/` reads `client/INSIGHTS.md`, not all five. Knowledge lives next to the
code it is about.

## Step 1 — Read first (mandatory)

Before answering a question or touching code:

1. Resolve the module from the request using the table below.
2. Read that `INSIGHTS.md` in full. It is capped and short — read it, don't grep.
3. Read the root `INSIGHTS.md` as well when the work spans two or more packages.
4. **Say in one line which file you read and what you will use from it.** If
   nothing applies: `Read server/INSIGHTS.md — nothing on SSE.` If something
   does, **name the entry, don't just say "relevant":** `Read server/INSIGHTS.md
   — following the compute-once counter pattern (2026-08-04).` Naming it forces
   you to actually apply it and proves the read happened; a silent read gets
   skipped.

If a curated file answers the question, cite it instead of re-deriving from
code. This is the order root `CLAUDE.md` already sets out: `specs/` → `docs/` →
`INSIGHTS.md` → source.

## Module resolution

| The work touches                                                            | File                        |
| --------------------------------------------------------------------------- | --------------------------- |
| `server/**`, including `src/modules/repo-intel/**`                           | `server/INSIGHTS.md`        |
| `client/**`                                                                  | `client/INSIGHTS.md`        |
| `reviewer-core/**`                                                           | `reviewer-core/INSIGHTS.md` |
| `e2e/**`, `scripts/e2e.sh`                                                   | `e2e/INSIGHTS.md`           |
| `scripts/`, `.github/`, `docker-compose.yml`, root docs, **or ≥2 packages**  | `INSIGHTS.md` (root)        |

Edge cases that get misfiled:

- **`server/src/vendor/shared/**` → root.** That is `@devdigest/shared`; a
  contract change there reaches every package, so it is never server-local.
- **`server/src/modules/repo-intel/` → `server/`.** It is a folder inside
  `@devdigest/api`, not a package of its own.
- **`client/src/vendor/**` → `client/`,** and only for insights about *consuming*
  it. The vendored code itself is not ours to change.
- A finding about the workflow itself (CI, `dev.sh`, package managers) → root.

## Step 2 — Record last (conditional)

Recording happens at the end, but *noticing* happens throughout. When something
non-obvious surfaces mid-task — a correction, a dead end, a quirk — flag it as a
one-line note and keep working. Do **not** write it into `INSIGHTS.md` the
moment it happens: wait until the fix is confirmed, or the record captures a
guess that was later wrong. At the end, the flags you were carrying become the
candidates below.

### 2a. Gate — is there anything to record?

Judge the session by feel, not by counting. A typo, a rename, a routine feature
that went exactly as expected → **write nothing, say "nothing worth recording",
stop.** Recording noise is worse than recording nothing.

Length is not the signal. A 30-second correction can be worth recording and a
two-hour slog can be worth nothing — what matters is whether a real problem,
decision, or discovery actually happened. Two tests sharpen the call:

- **Would a future session act differently for having read it?** If not — even
  after a long slog — it is noise. The bar is saving the next session real time,
  not restating what they would work out anyway.
- **Did you have to ask, dig, or get corrected to get unstuck?** Then the next
  session hits the same wall — the strongest signal there is to record.

One filter kills a common false positive: **do not record findings about code
that is actively changing** — the entry goes stale before it is read. Capture
the durable constraint, not the churn.

If something non-obvious did happen, collect candidates and rank them — highest
signal first:

1. **User corrections** — an explicit "no, do it this way". Highest signal there
   is; the repo was wrong or the agent's default was wrong.
2. **Approaches that failed** — what was tried and abandoned, and why.
3. **Repeated friction** — the same error or workaround hit more than once.
4. **Conventions discovered by reading code** — things `CLAUDE.md` doesn't say.
5. **Dependency and toolchain quirks.**

**Cap at 3 entries per session**, even when more candidates exist. If everything
looks worth writing, the bar is being applied too loosely.

### 2b. Write

**Append-only, in place — never overwrite.** Add to an `INSIGHTS.md` with a
**targeted `Edit`** that inserts or refines one span. **Never** use the `Write`
tool on an existing `INSIGHTS.md`, and never reproduce the whole file to change
one part of it — that is how the preamble, the section headings, and other
sessions' entries get clobbered. The only content you may remove is spelled out
below (a stale or superseded entry during a deliberate prune — and even a fixed
warning is *marked*, not deleted); everything else already in the file must
survive your edit unchanged.

For each surviving candidate:

1. **Read the target file** before editing it, so your `Edit` matches the real
   surrounding text and you can see what is already there.
2. **Check for a duplicate** — `grep -i '<key identifier>' <module>/INSIGHTS.md`.
   If a near-duplicate is there, **refine that entry** — sharpen the claim,
   update the date, add the evidence — instead of appending a near-copy.
3. **Insert** under the right section, newest first within that section — an
   `Edit` that adds your entry next to the existing ones, leaving them intact.
4. If a candidate contradicts an existing entry — including one in a *different*
   section (e.g. `What Works` says always do X while this says X fails here) — do
   **not** write both. Reconcile: correct or qualify the old one and note what
   changed.

Never delete an entry that still holds. When something an entry warns about gets
fixed in code, don't delete it either — mark it, so the next reader knows the
warning is historical:

```markdown
- **2026-07-31** — … original claim … **Fixed 2026-08-14 in `server/src/…`.**
```

### 2c. Report

One line per action, then stop. No trailing commentary.

```
server/INSIGHTS.md — added under What Doesn't Work: 422 on empty body …
Skipped: grounding-gate note (already covered by the 2026-07-31 entry)
```

## Which section

| Section                    | What belongs there                                          |
| -------------------------- | ------------------------------------------------------------ |
| `Decisions`                | A choice made, with the alternative that was rejected        |
| `What Works`               | An approach that solved something and should be reused       |
| `What Doesn't Work`        | A dead end — the section most often skipped, and the most valuable |
| `Codebase Patterns`        | A convention you had to discover by reading the code         |
| `Tool & Library Notes`     | A quirk of a dependency, CLI, or the toolchain               |
| `Recurring Errors & Fixes` | A symptom you will hit again, and its cause                  |
| `Open Questions`           | Something left unresolved, so the next session knows          |

## Entry format

`Decisions` keeps the existing three-line prose form:

```markdown
### 2026-07-31 — Mechanical grounding gate, not a trusted model

**What:** the decision, in one sentence.
**Why:** the constraint that forced it.
**Rejected:** what was tried, and how it failed.
```

Every other section takes a dated bullet — claim first, evidence last:

```markdown
- **2026-07-31** — plain `npm test` in `e2e/` fails flows 02/04/05 against the
  dev DB: flow 02 follows the home redirect to the *first* repo and a dev DB has
  several. Use `npm run e2e:hermetic`. `e2e/specs/02-repo-overview.flow.json`
```

House style: hard-wrap at ~79 columns, backtick every path and identifier, quote
the **actual** error string, and end with a `path:line` or a runnable command
wherever one exists. Keep each entry **atomic** — one insight per bullet; if it
carries two claims, split it.

## The bar

An entry must be actionable **cold** — the next session reads it and knows what
to do without re-deriving anything.

| ✗ Noise                      | ✓ Insight                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| "e2e tests can be flaky"     | "flows assume exactly one seeded repo — flow 02 follows the home redirect to the *first* one, so the dev DB fails 02/04/05; use `npm run e2e:hermetic`" |
| "be careful with migrations" | "`relation … does not exist` on a fresh clone means migrations were skipped — they do not run on boot. `cd server && pnpm db:migrate`"               |
| "Promises can be tricky"     | "`Promise.all()` over the ingest pipeline times out past ~30 items — use `Promise.allSettled()` in batches of 10"                                    |

**The test: if it would be obvious to anyone reading the code, don't write it.**
Generic advice is the failure mode — "use async carefully" is true everywhere and
therefore useful nowhere.

## Keeping the files lean

- Roughly **5 entries per section**. Past that, signal drops.
- When an entry becomes stable reference material, **promote it into
  `<module>/docs/` and delete it here.** That path is what keeps these short.
- An entry that no longer holds is worse than no entry. Correct or mark it.
- **Prune before you append when a file is already long or self-contradictory:**
  merge near-duplicates into the sharper one, mark entries the code has since
  fixed, delete ones that no longer hold. Trim on the way in — a file nobody
  trims rots into noise faster than one nobody writes to.

## Anti-patterns

- Writing an entry because the session was long, rather than because something
  was learned.
- A title instead of content — "fixed the SSE bug" tells the next session
  nothing. Write the claim, not the label.
- Filing everything under `What Works`.
- Appending a fifth variation of an entry that already exists.
- Recording what `CLAUDE.md`, `README.md`, or `docs/` already says.

## What this skill does not do

It captures insights only. It does not review code, write documentation, update
`specs/`, or run tests. `INSIGHTS.md` is not a session diary — it holds durable
findings, not a record of what happened.

## Two things to keep honest

- **Entries are a draft, not gospel.** This skill can mis-summarize what
  happened, so an entry is a high-confidence starting point — not a verified
  fact. Treat a surprising one as a lead to check, not a truth to act on blind,
  and let a human spot-check keep the files trustworthy. When you record a claim
  you could not verify, tag it inline `[unverified]` so the next session checks
  it before trusting it — better than dropping it or asserting it as fact.
  Entries also reflect what was true when written: if one names a file,
  function, or flag, confirm it still exists before relying on it.
- **The trigger is now hook-enforced.** Recording used to depend on someone
  remembering to run this skill — the weak link. Two committed hooks (wired in
  `.claude/settings.json`) close it: a `Stop` hook
  (`.claude/hooks/insights-record-gate.mjs`) blocks the first end-of-session
  stop **when the session edited files** and makes the agent run this record
  pass; a `SessionStart` hook (`.claude/hooks/insights-read-reminder.sh`)
  injects the read-first reminder. The Stop hook does **not** write anything
  itself and makes no separate model call — the harness hands it the session
  transcript as JSON on stdin, it only decides whether to force the pass, and
  the model still applies the gate above (a trivial session records nothing).
  It guards against loops via `stop_hook_active` and fails open on any error.
