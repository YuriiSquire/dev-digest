---
name: onion-architecture
version: 0.1.0
description: >-
  This skill should be used when writing or reviewing ANY DevDigest backend code
  and deciding WHICH LAYER owns a piece of logic and WHICH DIRECTION its
  dependencies point — server/ Fastify modules and the reviewer-core/ engine.
  Fires on any new or changed module, route, service, repository, or adapter:
  "where does this backend logic go", "which layer owns this", "how do I add a
  new module / route / repository / adapter", "should this touch the DB / Fastify
  / an external API here", ports and adapters, dependency inversion, the DI
  container, keeping the core framework-agnostic. This is onion / hexagonal /
  clean architecture for our Fastify + Drizzle backend — the codebase already
  follows it; this skill names and enforces it. Anti-scope: NOT frontend
  structure (defer to frontend-architecture), NOT Fastify route mechanics/plugins
  (defer to fastify-best-practices), NOT Drizzle query syntax (defer to
  drizzle-orm-patterns).
---

# Onion Architecture (DevDigest backend)

Decide **which layer owns a piece of backend code and which way its dependencies
point**, for `server/` Fastify modules and the `reviewer-core/` engine. Onion,
hexagonal, and clean architecture are the same idea under different names: a
domain core with zero infrastructure dependencies, wrapped in rings that all
point inward, with external systems reached only through interfaces.

The important thing to know: **DevDigest already implements this** — it is just
never named in the code. There are ports (`server/src/vendor/shared/adapters.ts`),
adapters (`server/src/adapters/`), a DI composition root
(`server/src/platform/container.ts`), layered modules (`routes → service →
repository`), and a pure dependency-inverted engine (`reviewer-core/`). This skill
makes the existing pattern explicit so every new piece of backend code lands in
the right ring. When you touch backend code, keep it conforming; do not invent a
new structure.

## How to use this skill

Start from the core principles, then open the one reference that matches the
decision at hand. Each reference is self-contained, grounded in real paths, and
cites its sources.

| Question | Reference |
| --- | --- |
| What are the rings and which way do dependencies point? | `references/layers.md` |
| How do I add an external dependency (API, DB, tool) behind an interface? | `references/ports-and-adapters.md` |
| How do I structure a module — routes vs service vs repository? | `references/module-anatomy.md` |
| How do I keep the core (reviewer-core) framework-agnostic? | `references/domain-core.md` |
| How is the layering kept honest / enforced? | `references/enforcement.md` |

Every source used to build this skill — with links — is listed in `README.md`.

## Core principles

These five ideas resolve almost every placement question. When a specific rule
feels ambiguous, fall back to the principle behind it.

- **Dependencies point inward.** Outer rings depend on inner rings; an inner ring
  never imports an outer one. The domain core depends on nothing external. This is
  Palermo's original rule — "code can depend on layers more central, but not on
  layers further out" — and it is the whole point of the pattern. The database and
  the web framework are outer details, not the center.

- **Depend on ports, not implementations.** Every external system (LLM, GitHub,
  git, code search, secrets, auth) is reached through an interface declared in
  `@devdigest/shared` (`adapters.ts`), never a concrete class. Services accept the
  interface; the container injects the implementation. The test: can you mock
  everything a unit touches? If it references interfaces, yes.

- **Each module is a layer stack.** A `server/src/modules/<name>/` folder splits
  into `routes.ts` (transport only — parse request, map status, delegate),
  `service.ts` (business logic, **no HTTP and no raw SQL**), and `repository.ts`
  (**the only** layer that touches Drizzle). Logic never lives in a route; SQL
  never lives in a service.

- **The container is the composition root.** All wiring lives in
  `platform/container.ts`. Nothing else `new`s up an adapter. Cross-module access
  goes through `container.*` (e.g. `container.repoIntel`, `container.agentsRepo`) —
  never by importing another module's `service.ts` or `repository.ts` directly.

- **The domain core stays framework-agnostic.** `reviewer-core/` takes its LLM
  provider, cost estimator, cancellation, and all I/O as **injected inputs** — no
  database, GitHub, or filesystem access. Purity is its contract; anything needing
  I/O belongs in `server/`, not the core.

## Layers

The rings, inner to outer, mapped onto the real tree. Full detail and the
dependency rule are in `references/layers.md`.

- **Contracts / ports** (`vendor/shared/*`) → **domain core** (`reviewer-core/`) →
  **application services** (`modules/*/service.ts`) → **data access**
  (`modules/*/repository.ts`, `db/schema/*`) → **infrastructure adapters**
  (`adapters/*`) → **composition root** (`platform/container.ts`) → **transport**
  (`modules/*/routes.ts`, `app.ts`).
- Persistence has a lighter seam than external systems: the strong port/adapter
  inversion is applied to *external* systems (LLM, GitHub, git, …), while
  repositories are concrete classes that receive the Drizzle handle by injection
  and are swapped in tests via a real test DB, not an interface mock. The one
  module with a full domain-port facade is `repo-intel` (`RepoIntel` in `types.ts`).

## Ports and adapters

Add an external dependency by inverting it, never by calling a client inline.
Full recipe in `references/ports-and-adapters.md`.

- Declare the **port** (interface) in `server/src/vendor/shared/adapters.ts`
  (`LLMProvider`, `Embedder`, `GitHubClient`, `GitClient`, `CodeIndex`,
  `AuthProvider`, `SecretsProvider`).
- Implement the **adapter** under `server/src/adapters/<area>/` and export it from
  `adapters/index.ts`.
- Wire it in `platform/container.ts` as a lazy getter typed by the **port**, which
  returns the test override when present, else the concrete adapter.
- Services take the interface off the container — never `new SomeClient()` in a
  service.

## Module anatomy

The canonical module shape, with `modules/repos/*` as the worked example. Full
walkthrough and a "new module" checklist in `references/module-anatomy.md`.

- `routes.ts` — Fastify plugin; declares Zod `params`/`body`/`response` from
  `@devdigest/shared`; resolves tenancy via `getContext`; delegates to the service.
- `service.ts` — orchestration and business rules; depends on ports via the
  container; owns its `repository.ts`.
- `repository.ts` — every Drizzle query for the module's table, each scoped by
  `workspaceId`. `helpers.ts` for pure transforms, `constants.ts` for literals.
- Register the module once in `modules/index.ts` (one import + one `app.register`).

## Domain core

Keep `reviewer-core/` pure. Full guidance in `references/domain-core.md`.

- No DB / GitHub / filesystem; the only side effect is an LLM call through an
  **injected** `LLMProvider`. Cancellation, progress, and cost are injected too.
- Consumed as TypeScript source via a path alias; it emits no JS (its build is a
  typecheck). Contracts come from `@devdigest/shared`.
- I/O (loading a diff, reading memory, calling GitHub) stays in the `server/`
  caller and is passed in as resolved values.

## Enforcement

The layering is a convention today, enforced by review, not a lint rule (a
committed boundary check is a deliberate future step — see
`references/enforcement.md`). Keep it honest by asking, on every backend diff:

- Does a `service.ts` import `drizzle-orm` or build SQL? → move it to the repository.
- Does a `routes.ts` contain business logic? → move it to the service.
- Does anything `new` an adapter outside `container.ts`? → wire it in the container.
- Does the domain core (`reviewer-core/`) reach for I/O? → inject it instead.
- Does a module import another module's internals? → go through `container.*`.

## Decision heuristics

A quick cheat sheet when unsure where a line of code belongs:

- **Touches the DB?** → `repository.ts`.
- **A business rule or orchestration?** → `service.ts`.
- **Parses HTTP / maps a status code?** → `routes.ts`.
- **Calls an external system?** → behind a port in `adapters.ts` + an adapter,
  injected via the container.
- **Pure, no infrastructure, reusable by CI too?** → `reviewer-core/`.
- **Need another module's data?** → `container.<thing>`, never a cross-module import.

## Related skills

- **fastify-best-practices** — route/plugin mechanics, JSON-schema validation,
  hooks, error handling. Defer to it for *how Fastify works*; this skill owns
  *which layer the code lives in*.
- **drizzle-orm-patterns** — Drizzle schema, queries, relations, migrations. Defer
  to it for *query syntax*; this skill owns *that queries live only in the
  repository ring*.
- **frontend-architecture** — the same "where does this go" question for the
  React/Next client. This skill is its backend sibling.
- **engineering-insights** — run at the end of a backend task to record anything
  non-obvious into the touched module's `INSIGHTS.md`.

## Sources

All references, with links, author, and a one-line takeaway, are catalogued in
`README.md`. Every claim here traces to a source there or to a cited path in this
repo; do not add guidance without one.
