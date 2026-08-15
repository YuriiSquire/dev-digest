# The domain core

The center of the onion is a domain core with **zero infrastructure
dependencies**. In DevDigest that core is the `reviewer-core/` package — the
review engine. Its purity is a hard contract, and it is the codebase's clearest
demonstration of the whole pattern paying off.

## Purity is the contract

`reviewer-core/src/index.ts` states it: *"Pure review logic … NO database,
GitHub, or filesystem access; the only side effect is an LLM call through an
INJECTED LLMProvider (so it is mock-testable)."* Restated as rules (from
`reviewer-core/CLAUDE.md`):

- No database, no GitHub, no filesystem. Anything that needs I/O belongs in
  `server/`, not here.
- The only side effect is an LLM call through an **injected** `LLMProvider`.
- Contracts (`Review`, `Finding`, `Verdict`, …) come from `@devdigest/shared` — the
  innermost contracts ring, which the core is allowed to depend on.
- It is consumed as TypeScript **source** through a path alias and emits no JS; its
  build is a typecheck. Never add a build step or import from `dist`.

This is Stemmler's "code can only point inwards" and Palermo's dependency rule in
their purest local form: the core points only at the contracts ring, at nothing
outward.

## Everything the core needs is injected

The engine entry point `reviewPullRequest(input: ReviewInput)` in
`reviewer-core/src/review/run.ts` receives its dependencies as inputs rather than
importing them:

- The **`LLMProvider`** (the port) — the caller decides which provider and injects
  it. The same engine runs in the studio server and the CI runner; only the
  injected adapter differs.
- **Already-resolved I/O** — the diff, and the assembled prompt slots (`skills`,
  `memory`, `specs`, `repoMap`, `callers`) arrive as plain strings. Reading them
  from the DB, GitHub, or the filesystem happens in the `server/` caller and stays
  there.
- **Cancellation and progress** as injected callbacks, so the engine never learns
  the caller's error types or transport.
- **Cost attribution** as an injected estimator on `OpenRouterProvider` — "the
  engine stays free of a pricing table."

## The mockability test

The quickest way to check whether something belongs in the core: **can you mock
everything it touches?** Stemmler's heuristic — if the code references interfaces
or abstract types rather than concrete infrastructure, the answer is yes, and the
unit test needs no keys, no network, and no database. `reviewer-core`'s test suite
runs hermetically against a stubbed `LLMProvider` precisely because every
dependency is a port passed in. If a change to the core would force a test to
stand up a database or hit an API, that change belongs in `server/` instead.

## When you are tempted to break purity

Typical pulls and where the work actually goes:

- "The engine needs the repo map / caller signatures." → Resolve it in the caller
  (via `container.repoIntel`) and pass the resolved string into `reviewPullRequest`.
- "The engine should persist the run / post to GitHub." → No. The engine returns a
  `ReviewOutcome`; the `server/` caller persists it and posts it through the
  `GitHubClient` adapter.
- "The engine needs the current model's price." → Inject an `estimateCost` function;
  do not import a pricing table.

Keep the core a pure function of its inputs. That is what lets one engine serve
both the interactive studio and the CI runner without change.

## Sources

- Khalil Stemmler — *Clean Node.js Architecture* (mockability, point-inwards): <https://khalilstemmler.com/articles/enterprise-typescript-nodejs/clean-nodejs-architecture/>
- Jeffrey Palermo — *The Onion Architecture: part 1*: <https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/>
- DevDigest source: `reviewer-core/src/index.ts`, `reviewer-core/src/review/run.ts`, `reviewer-core/CLAUDE.md`.
