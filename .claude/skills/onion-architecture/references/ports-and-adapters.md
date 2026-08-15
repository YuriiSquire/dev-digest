# Ports and adapters

How to reach an external system — an API, a CLI tool, a key store — without
letting it leak into the core. The rule: **all external calls go behind an
interface (a port); the concrete client (an adapter) implements it; the container
injects the adapter into the service.** Services depend on the interface, not the
implementation.

In ports-and-adapters terms, interfaces and abstract types are the **ports**;
concrete classes are the **adapters**. The dependency inversion is the whole
point: business logic defines the shape it needs, and the infrastructure fits
that shape — the arrow points inward, never outward.

## The port — an interface in `@devdigest/shared`

Ports live in `server/src/vendor/shared/adapters.ts`, whose own header states the
rule: *"Adapter interfaces. ALL external calls go behind these interfaces …
Services depend on the interface, not the impl."* The declared ports:

- `LLMProvider` — chat + structured completion + embeddings.
- `Embedder` — text → vectors.
- `GitHubClient` — PRs, reviews, inline comments, commits (Octokit REST).
- `GitClient` — clone, fetch, diff, blame (simple-git).
- `CodeIndex` — grep / symbols / references (ripgrep + tree-sitter).
- `AuthProvider` — current user / workspace.
- `SecretsProvider` — get/set secrets.

A port is a plain TypeScript `interface` (plus any Zod-described value objects
like `ModelInfo`, `RepoRef`, `UnifiedDiff`). It names *what the core needs* in the
core's vocabulary — not the vendor's SDK surface.

## The adapter — a concrete implementation under `server/src/adapters/`

Each port has one real implementation, organized by area and exported from the
barrel `server/src/adapters/index.ts`:

- `secrets/local.ts` → `LocalSecretsProvider`
- `auth/local.ts` → `LocalNoAuthProvider`
- `github/octokit.ts` → `OctokitGitHubClient`
- `git/simple-git.ts` → `SimpleGitClient`
- `codeindex/ripgrep.ts` → `RipgrepCodeIndex`
- `llm/openai.ts`, `llm/anthropic.ts` → provider clients (plus `OpenRouterProvider`,
  which lives in `reviewer-core` and is shared with the CI runner)
- `embedder/openai.ts` → `OpenAIEmbedder`

The barrel also re-exports `mocks.ts` — the fake adapters tests inject. An adapter
is the *only* place the vendor SDK is imported; nothing upstream knows Octokit or
simple-git exists.

## The composition root — wiring in `platform/container.ts`

The `Container` is the single place adapters are constructed. Each port is a lazy
getter **typed by the interface**, resolving the test override first, then the
concrete adapter:

```ts
get codeIndex(): CodeIndex {
  if (this.overrides.codeIndex) return this.overrides.codeIndex;
  this._codeIndex ??= new RipgrepCodeIndex(this.git);
  return this._codeIndex;
}
```

Secret-dependent adapters are built through `SecretsProvider` and are async
(`await container.github()`, `await container.llm('openrouter')`), throwing a
`ConfigError` when a key is missing rather than at boot. `ContainerOverrides` is
how tests inject mocks: *"Tests construct a container with `overrides` to inject
mock adapters; the Services depend on these interfaces, not the concrete classes."*

Cross-cutting repositories (`agentsRepo`, `reviewRepo`) are also owned here — the
comment says it plainly: *"Constructed here, in the composition root, so consuming
modules use `container.agentsRepo` instead of reaching into another module's
folder."* That is how one module uses another's data without a cross-module
import.

## Recipe — adding a new external dependency

1. **Define the port.** Add an `interface` to `server/src/vendor/shared/adapters.ts`
   describing what the core needs, in the core's terms. (Contracts change in
   `@devdigest/shared` first — and remember the client copy is a separate file;
   keep the two in sync per `server/CLAUDE.md`.)
2. **Implement the adapter.** Add `server/src/adapters/<area>/<impl>.ts` that
   `implements` the port and is the only file importing the vendor SDK. Export it
   from `adapters/index.ts`; add a fake to `mocks.ts`.
3. **Wire it in the container.** Add a private cache field, an override slot on
   `ContainerOverrides`, and a lazy getter typed by the port (async if it needs a
   secret).
4. **Inject it into the service.** The service reads `container.<thing>` — it never
   `new`s the adapter. Unit-test the service with the mock via `overrides`.

If you find yourself importing an SDK or `new`-ing a client anywhere but an
adapter, that is the smell this pattern exists to remove — stop and add a port.

## Sources

- Khalil Stemmler — *Clean Node.js Architecture*: <https://khalilstemmler.com/articles/enterprise-typescript-nodejs/clean-nodejs-architecture/>
- Sairyss — *Domain-Driven Hexagon*: <https://dev.to/sairyss/domain-driven-hexagon-18g5>
- Herberto Graça — *Onion Architecture* (2017): <https://herbertograca.com/2017/09/21/onion-architecture/>
- DevDigest source: `server/src/vendor/shared/adapters.ts`, `server/src/adapters/index.ts`, `server/src/platform/container.ts`.
