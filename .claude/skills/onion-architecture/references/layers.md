# Layers and the dependency rule

The rings of the onion, from the center out, and the single rule that holds them
together — mapped onto DevDigest's actual backend tree.

## The dependency rule

> All code can depend on layers more central, but code cannot depend on layers
> further out from the core. — Jeffrey Palermo, *The Onion Architecture* (2008)

Every arrow points inward. The domain at the center depends on nothing external;
each ring outward may use the rings inside it but is invisible to them. The
database and the web framework sit on the *outside* — "the database is not the
center, it is external" (Palermo). Herberto Graça states the same rule as "outer
layers depend on inner; inner layers do not know about outer," and adds a useful
relaxation: **any outer layer may call any inner layer directly** — you do not
need a pass-through method in every intermediate ring just to preserve symmetry.

## The rings, mapped to this repo

Inner → outer:

1. **Contracts / ports** — `server/src/vendor/shared/*` (the vendored
   `@devdigest/shared`). Zod contracts (`Finding`, `Review`, `PrMeta`, …) and the
   adapter **interfaces** in `adapters.ts`. This is the innermost, most stable
   ring; everything else depends on it, it depends on nothing in the app.
2. **Domain core** — `reviewer-core/`. Pure review logic (prompt assembly,
   grounding gate, map-reduce, structured output). Depends only on the contracts
   ring; all I/O is injected. See `domain-core.md`.
3. **Application services** — `server/src/modules/<name>/service.ts`. Business
   logic and orchestration for one feature. Depends on ports through the container;
   contains no HTTP and no SQL.
4. **Data access** — `server/src/modules/<name>/repository.ts` plus the Drizzle
   schema in `server/src/db/schema/*`. The only ring that touches the database.
5. **Infrastructure adapters** — `server/src/adapters/*`. Concrete implementations
   of the ports (Octokit, simple-git, ripgrep, OpenAI/Anthropic, local secrets).
6. **Composition root** — `server/src/platform/container.ts`. Wires adapters to
   the ports and hands them to services. Depends on everything; nothing depends on
   it except the app entry.
7. **Transport** — `server/src/modules/<name>/routes.ts` and `server/src/app.ts`.
   The outermost ring: HTTP in, HTTP out. Parses and validates the request, maps
   status codes, delegates inward.

Cross-cutting concerns (tenancy resolution in `modules/_shared/context.ts`,
background jobs in `platform/jobs.ts`, SSE in `platform/sse.ts`, errors in
`platform/errors.ts`) live in `platform/` and `_shared/` and are reached through
the container, not duplicated per module.

## Where a repository interface lives — the one nuance

Sources disagree on this, so it is worth stating what *we* do. Palermo places the
repository **interface** in the application core and the implementation on the
edge. Graça argues repositories belong in the application layer, since the domain
should have "no knowledge of persistence." DevDigest takes a lighter, pragmatic
position that is consistent across the codebase:

- **External systems get the full port/adapter inversion.** LLM, GitHub, git, code
  search, secrets, and auth each have an interface in `adapters.ts` and a swappable
  implementation — because they are slow, non-deterministic, or key-dependent, and
  unit tests must mock them.
- **Repositories are concrete classes, not interfaces.** A `repository.ts` receives
  the Drizzle handle (`Db`) by constructor injection and is the seam itself. Tests
  swap the *database* (a real testcontainers Postgres in `*.it.test.ts`), not an
  interface mock. This keeps persistence honest without a mock layer that would
  drift from real SQL behavior.
- **The exception is `repo-intel`,** which *does* expose a domain-port facade: the
  `RepoIntel` interface in `server/src/modules/repo-intel/types.ts`, implemented by
  its `service.ts` and returned from the container **by interface type**. It is the
  closest thing in the codebase to a classic onion domain port, and the model to
  copy when a module's internals (here: ast-grep, dependency-cruiser, graphology)
  are heavy enough that consumers must be insulated from them.

So: invert *external* dependencies with interfaces; let repositories be concrete
classes injected with `Db`; reach for a module-level facade interface only when a
module hides real library complexity that other modules must not see.

## Why this ordering pays off

The payoff is the same one Palermo argued for long-lived business applications:
the core outlives its infrastructure. Data-access tech, the LLM provider, and the
web framework all change on their own clocks; because they sit in outer rings
behind interfaces, swapping one does not ripple into the domain. `reviewer-core`
is the proof — the *same* pure engine runs in the studio server and in the CI
runner, differing only in which adapters the caller injects.

## Sources

- Jeffrey Palermo — *The Onion Architecture: part 1* (2008): <https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/>
- Herberto Graça — *Onion Architecture* (2017): <https://herbertograca.com/2017/09/21/onion-architecture/>
- Allegro Tech — *Onion Architecture* (2023): <https://blog.allegro.tech/2023/02/onion-architecture.html>
- DevDigest source: `server/src/vendor/shared/adapters.ts`, `server/src/platform/container.ts`, `server/src/modules/repo-intel/types.ts`, `reviewer-core/src/index.ts`.
