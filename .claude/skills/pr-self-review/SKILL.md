---
name: pr-self-review
version: 0.1.0
description: >-
  Use BEFORE opening a pull request, and on demand, to self-review the current
  branch's committed diff against DevDigest's own skills. Triggers: "open a PR",
  "gh pr create", "ready for review", "review my changes before the PR", "self
  review", "/pr-self-review". It resolves the PR base branch, classifies every
  changed file (frontend / backend / database / cross-cutting), fans out one
  review subagent per relevant skill, collects severity-tagged findings, and
  returns a PASS/BLOCK verdict — a single critical finding BLOCKS the PR until it
  is resolved. Anti-scope: does NOT open, merge, or push the PR itself; does NOT
  re-implement a deep single-file code pass (defer to the built-in code-review /
  security-review skills for that). It ORCHESTRATES the existing DevDigest skills
  over a diff — it does not restate their content.
---

# PR Self-Review (DevDigest)

Run a **self-review of the branch's committed diff before the PR is opened.** The
repo ships a rich set of skills (frontend-architecture, react-best-practices,
next-best-practices, onion-architecture, fastify-best-practices,
drizzle-orm-patterns, postgresql-table-design, security, zod, typescript-expert),
but nothing routes a *diff* to the right subset of them. This skill does exactly
that: classify each changed file, apply only the skills that fit, and gate the PR
on the result.

The verdict is a **soft block**: on any `critical` finding the skill prints
`VERDICT: BLOCK` and **refuses to run `gh pr create`** until the critical is
resolved. There is no git hook — the block is behavioral, carried by this skill.

## How to use this skill

Work through the steps in order. `references/routing.md` is the authoritative
file-glob → skill classifier; `references/severity.md` defines the rubric and the
gate. Consult those two files rather than guessing.

| Question | Reference |
| --- | --- |
| Which skills apply to a given changed file? | `references/routing.md` |
| What counts as critical, and what blocks the PR? | `references/severity.md` |

Unlike the research-backed skills, this one has no `## Sources` / `README.md`
section: it orchestrates the existing DevDigest skills over a diff rather than
teaching researched content, so there are no external sources to cite — the
authorities are the skills it routes to.

## Step 0 — Resolve the base branch `$BASE` (never hard-code)

The repo has both `develop` and `main` (`origin/HEAD → main`), and `feat/*`
branches may target either. Resolve the base at runtime:

1. If a PR already exists for the current branch, use its target:
   `gh pr view --json baseRefName -q .baseRefName` (skip if `gh` is unavailable or
   no PR exists — do not fail the run).
2. Otherwise pick the candidate base whose merge-base is **nearest** HEAD — the
   branch this feature actually forked from. For each candidate that exists
   (`develop`, `main`): `git rev-list --count <candidate>..HEAD`; choose the
   smallest count.
3. If only one candidate exists, fall back to `origin/HEAD` (→ `main`).

Echo the resolved `$BASE` in the report header so the target is never ambiguous.

## Step 1 — Compute the diff (committed, PR-equivalent, vs `$BASE`)

- `git diff --name-only --merge-base $BASE HEAD` → the changed-file list.
- **Exclude** the root `CLAUDE.md` do-not-touch paths: `server/clones/**`
  (gitignored anyway), `**/node_modules/**`, `**/src/vendor/**`, `pnpm-lock.yaml`,
  `package-lock.json`.
- If the list is empty → print `nothing to review vs $BASE` and stop.
- For each surviving file, capture its diff body with
  `git diff --merge-base $BASE HEAD -- <path>` to hand to the reviewer.

**The `HEAD` endpoint is required.** The one-arg `git diff --merge-base $BASE`
(no `HEAD`) diffs the merge-base against the **working tree**, which would pull in
uncommitted edits. Uncommitted working-tree changes are out of scope — this
reviews what the PR would contain, not your dirty tree. (`$BASE...HEAD` is an
equivalent form.)

## Step 2 — Classify each file into buckets

Apply `references/routing.md`. Buckets:

- **Frontend** — `client/**` (`.tsx`, `.ts`, `.css`).
- **Backend** — `server/src/**/*.ts`, `reviewer-core/src/**/*.ts`.
- **Database** — `server/src/db/**`, `server/drizzle.config.ts`,
  `server/src/db/migrations/**`.
- **Cross-cutting** (evaluated by *content*, on top of the path bucket) —
  security-sensitive code (auth, secrets, input handling, uploads, API endpoints),
  Zod usage (`z.object` / `z.string` / `safeParse` / `z.infer`), and general TS
  quality on any `.ts` / `.tsx`.

A file can land in one path bucket plus one or more cross-cutting concerns.

## Step 3 — Route buckets to skills

Only spawn a reviewer for a `(skill, files)` pair when at least one changed file
matches. Honor each skill's anti-scope so overlapping concerns are not
double-reviewed (routing table lives in `references/routing.md`):

| Bucket / marker | Skills to load and apply |
| --- | --- |
| Frontend (any) | `frontend-architecture` (structure), `react-best-practices` (runtime / anti-patterns) |
| Frontend + App Router markers (`client/src/app/**`, `page.tsx` / `layout.tsx`) | add `next-best-practices` |
| Frontend test files (`client/**/*.test.ts(x)`) | `react-testing-library` |
| Backend (`server/src/**`, `reviewer-core/**`) | `onion-architecture` (layering / dep direction) |
| Backend + Fastify markers (`app.ts` / `server.ts`, routes, `server/src/platform/**`) | add `fastify-best-practices` |
| Database | `drizzle-orm-patterns` + `postgresql-table-design` |
| Cross-cutting: security-sensitive | `security` |
| Cross-cutting: Zod usage | `zod` |
| Any TS / TSX | `typescript-expert` (general quality) |

Never send a backend file to a UI reviewer or vice-versa, and never classify a
`server/clones/**` path.

## Step 4 — Fan out review subagents

For each active `(skill × file-bucket)` pair, spawn a `general-purpose` review
subagent **in parallel** (single message, multiple Agent calls). Each subagent
gets:

- **the skill to review through**, delivered as an instruction to `Read` that
  skill's files by absolute path — e.g.
  `/Users/<you>/Developer/dev-digest/.claude/skills/onion-architecture/SKILL.md`
  and its `references/` — then review strictly through that lens. Do **not** tell
  the subagent to "invoke the skill": a subagent has no skill catalog and cannot
  call the Skill tool. Reading the `SKILL.md` file is what actually works.
- the **file paths and their diff bodies** for that bucket,
- the **severity rubric**, delivered the same way — the subagent `Read`s this
  skill's `references/severity.md` by absolute path,
- a required **structured return**: a JSON array of findings, each
  `{ file, line, severity, category, summary, suggestion }`.

Use `general-purpose`, not `Explore` — `Explore` is a read-only *locator* that
reads excerpts and is documented not to audit, so it cannot do a full-diff lens
review. Filter out `null` returns (a subagent that died).

## Step 5 — Aggregate and gate

- Collect all findings; dedupe by `(file, line, summary)`.
- Compute the verdict per `references/severity.md`:
  **any `critical` → BLOCK; otherwise PASS.**

## Step 6 — Report and enforce

Print a report grouped by severity, then by file:

```
PR Self-Review — <branch> vs <$BASE>   (<n> files, <m> findings)
VERDICT: BLOCK — 2 critical findings must be resolved before opening the PR
── critical ──
  server/src/modules/pulls/repository.ts:42  [onion-architecture]  <summary>  → <suggestion>
  ...
── major ── ...
── minor / nit ── ...
```

- On **BLOCK**: do **not** run `gh pr create`. List the criticals to fix and stop.
- On **PASS**: state the diff is clear to open; you may then proceed to open the PR
  if that was the user's intent.

## Related skills

- **code-review / security-review** (built-in) — deep single-file passes. This
  skill defers to them; it only *orchestrates* the DevDigest skills over a diff.
- **onion-architecture / frontend-architecture** — the lenses this skill routes
  backend and frontend files through, respectively.
- **engineering-insights** — run at the end of a real task to record anything
  non-obvious; this skill's routing/overlap findings belong in the root
  `INSIGHTS.md`.
