# Keeping the layering honest

The onion only holds if the dependency direction is actually maintained. Today in
DevDigest that is enforced by **convention and code review**, not by a lint rule.
This reference covers the review checklist that catches violations now, and the
mechanical options for later — committing an automated boundary check is a
deliberate, separate step, intentionally **not** done as part of this skill.

## The review checklist (use this now)

On any backend diff, ask:

- **Does a `service.ts` import `drizzle-orm` or build `sql\`…\``?** → A query
  escaped the data-access ring. Move it into the module's `repository.ts`.
- **Does a `routes.ts` contain business logic** (branching on domain state,
  computing results)? → Move it into the `service.ts`; the route should parse,
  delegate, and map status.
- **Does anything `new` an adapter** (a vendor client, `new OctokitGitHubClient(…)`)
  **outside `platform/container.ts`?** → Wire it in the container and inject it.
- **Does `reviewer-core/` reach for I/O** (DB, GitHub, `fs`, `process.env`)? → Break
  purity is forbidden; inject the resolved value from the `server/` caller instead.
- **Does a module import another module's `service.ts`/`repository.ts` directly?** →
  Go through `container.*` (e.g. `container.repoIntel`, `container.agentsRepo`). The
  one allowed cross-module import is a sibling `constants.ts`.
- **Is a new external system called inline** instead of behind a port in
  `adapters.ts`? → Add the port + adapter (see `ports-and-adapters.md`).

The header-comment discipline the repo already uses is part of enforcement: files
declare their ring in the top comment (*"Transport layer only…"*, *"No HTTP and no
raw SQL live here…"*, *"The ONLY place that touches the `repos` table"*). Keep
writing them — they make a violation obvious in review.

## Mechanical enforcement (options, not yet wired)

When the team wants the boundary compiler-checked rather than review-checked,
these are the routes. Adopting one is a future task; this skill only documents
them.

- **ESLint `import/no-restricted-paths`.** Declare zone rules that forbid importing
  outward: a service may not import from `adapters/`, `reviewer-core/` may not
  import from `server/`, one module may not import another's internals. This is the
  same mechanism the `frontend-architecture` skill cites (via bulletproof-react)
  for the client's `shared → features → app` rule — so the repo would be applying a
  familiar tool to the backend rings.
- **dependency-cruiser.** Rule-based import-graph validation with a `forbidden`
  ruleset and a CI check. Fitting here because the codebase **already depends on
  dependency-cruiser** — it powers the `repo-intel` import graph via the
  `DepCruiseGraph` adapter — so no new dependency is needed to add an architecture
  ruleset.
- **Build-tool module boundaries.** The strongest form, where each ring is a
  separate build unit and an outward import simply does not compile. The Allegro
  Tech write-up argues for exactly this (Gradle/Maven modules) over naming
  conventions; in our world the closest analogue is the package split
  (`reviewer-core` is already its own package that cannot import `server`), which is
  why the core's purity is the hardest-enforced boundary we have.

## Recommended path when you do wire it

Start with the cheapest check that covers the highest-value rule: a
dependency-cruiser `forbidden` rule that blocks `service.ts → drizzle-orm` and
`modules/*/… → adapters/*`, plus the existing package split that already isolates
`reviewer-core`. Add a CI job that runs it on backend changes. Treat lint rules as
the enforcement of the review checklist above, not a replacement for the
header-comment discipline.

## Sources

- bulletproof-react — *Project Standards* (`import/no-restricted-paths` for import direction): <https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md>
- Allegro Tech — *Onion Architecture* (build-tool module enforcement over conventions): <https://blog.allegro.tech/2023/02/onion-architecture.html>
- DevDigest source: `server/src/adapters/depgraph/` (`DepCruiseGraph`), `server/src/platform/container.ts`, `server/CLAUDE.md`.
