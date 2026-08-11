# repo-intel — agent notes

The codebase indexer inside `server/` — powers the **Indexed** badge and feeds
the review prompt. A delta over `server/CLAUDE.md` and the root map; read those
first.

## Conventions

- **Starter infrastructure, read-only at review time.** It indexes on clone/fetch;
  a review only *reads* through the facade. Never re-index from a review path.
- Everything downstream goes through the `repoIntel.*` facade (`service.ts`) —
  consumers never touch `pipeline/` internals.
- Only `getRepoMap` / `getFileRank` / `getCallerSignatures` are wired in the
  starter (into `../reviews/run-executor.ts`). `getBlastRadius` /
  `getUnresolvedReferences` / `getConventionSamples` exist for later lessons —
  don't assume they have callers yet.

## Gotchas

- Enrichment is gated by `REPO_INTEL_ENABLED` (global) **and** a per-agent
  `repo_intel` flag. An unindexed repo degrades silently to diff-only — the facade
  returns empty results rather than throwing.
- Clones live in `server/clones/` — gitignored, and excluded from any search.

## Read when

- Pipeline diagram + facade + routes → `README.md`.
- Broader server conventions, commands, DB schema → `../../../CLAUDE.md` and root.
- **End of a non-trivial task:** run the `engineering-insights` skill — this module
  has no `INSIGHTS.md` of its own; findings land in `server/INSIGHTS.md`.
