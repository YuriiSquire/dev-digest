# onion-architecture — skill

A curated skill that names and enforces **onion / hexagonal / clean architecture**
for DevDigest's backend — the `server/` Fastify modules and the `reviewer-core/`
engine. It decides *which ring owns a piece of code and which way its dependencies
point*. The codebase already follows the pattern; this skill makes it explicit so
new code stays conforming. Version `0.1.0`.

- Entry point: [`SKILL.md`](./SKILL.md) — core principles + per-topic rules.
- Depth: [`references/`](./references) — one self-contained file per question.

## Scope and relation to other skills

This skill owns *backend layering and dependency direction*. It deliberately does
not duplicate:

- **fastify-best-practices** — route/plugin mechanics, JSON-schema validation,
  hooks, error handling.
- **drizzle-orm-patterns** — Drizzle schema, query syntax, relations, migrations.
- **frontend-architecture** — the same "where does this go" question for the client.

`SKILL.md` cross-references these instead of restating them.

## Reference files

| File | Covers |
| --- | --- |
| `references/layers.md` | the rings inner→outer mapped to our tree, the dependency rule, the repository-interface nuance |
| `references/ports-and-adapters.md` | ports in `adapters.ts`, adapters in `adapters/`, the DI container, the "add a dependency" recipe |
| `references/module-anatomy.md` | the `routes → service → repository` module shape, supporting files, the facade variant, a new-module checklist |
| `references/domain-core.md` | keeping `reviewer-core` pure — injected deps, the mockability test |
| `references/enforcement.md` | the review checklist + mechanical options (ESLint boundaries, dependency-cruiser, package split) |

## Sources

Every architectural claim in the skill traces to one of the sources below; every
code claim traces to a cited path in this repo. All URLs were **fetched and read**
during authoring (Aug 2026), and each claim was checked against the page it cites
(not merely that the URL resolves) — this fidelity re-check is a repo convention
recorded in the root `INSIGHTS.md` after a prior skill shipped a misattribution
that a URL-reachability pass had missed. Do not add guidance to the skill without a
citation here.

### Onion / clean architecture — canonical

1. **The Onion Architecture: part 1** — Jeffrey Palermo, 2008 — <https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/>
   Origin of the pattern. Domain model at the center; "the database is not the center, it is external"; all coupling points inward; relies on the Dependency Inversion Principle with runtime injection of edge implementations. (Part 1 of a 4-part series; parts 2–4 elaborate but part 1 carries the rules cited here.)
2. **Onion Architecture** — Herberto Graça, 2017 — <https://herbertograca.com/2017/09/21/onion-architecture/>
   Onion as an evolution of Ports & Adapters. "Outer layers depend on inner; inner layers do not know about outer"; any outer layer may call any inner directly (no mandatory pass-through). Argues repositories belong in the application layer — the counter-position to Palermo used in `layers.md`.
3. **Onion Architecture** — Allegro Tech blog, 2023 — <https://blog.allegro.tech/2023/02/onion-architecture.html>
   Dependency direction always outside→inside; domain freed of infrastructure. Distinctive angle: enforce boundaries with **build-tool modules** rather than naming conventions, and the tradeoff (build complexity vs compiler-checked rings). Feeds `enforcement.md`.

### Node.js / TypeScript practice

4. **Clean Node.js Architecture** — Khalil Stemmler — <https://khalilstemmler.com/articles/enterprise-typescript-nodejs/clean-nodejs-architecture/>
   Node/TS framing: "code can only point inwards"; ports as interfaces in the domain with competing adapter implementations; inject concretes at startup, never in domain code; the mockability heuristic used in `domain-core.md`.
5. **Domain-Driven Hexagon** — Sairyss (DEV Community) — <https://dev.to/sairyss/domain-driven-hexagon-18g5>
   Concrete TS layer breakdown and the import rules (domain → nothing, application → domain, infrastructure → both); organize by feature/bounded-context with domain/application/infrastructure inside each.
6. **Clean Architecture with TypeScript: DDD, Onion** — André Bazaglia — <https://bazaglia.com/clean-architecture-with-typescript-ddd-onion/>
   Worked TypeScript example (Domain → Use Cases → Infrastructure → API) with entities (private constructors + factory methods), repository interfaces as secondary adapters, and DI via `inversify`.

### Accuracy notes

- Sources 1–6 were each fetched and read during authoring; none is cited from a
  search snippet alone. A Medium walkthrough and a boilerplate repo that surfaced in
  search were **dropped** rather than cited, to keep every listed source
  fetch-verified.
- Sources 1 (Palermo) and 2 (Graça) **disagree** on where a repository interface
  belongs; `layers.md` presents both and states DevDigest's own pragmatic position
  (external systems get full port/adapter inversion; repositories are concrete
  classes injected with `Db`; a module-level facade interface only where library
  complexity demands it).
- These are living pages; the URLs are stable and the architectural rules cited are
  the durable, load-bearing parts, not incidental phrasing.

## Authoring notes

- Structure and frontmatter follow the repo's skill conventions (see
  `frontend-architecture/`, `zod/`): a lean `SKILL.md` index with depth in
  `references/`, a third-person "pushy" trigger-loaded `description`, a `version`
  field, imperative body style.
- The skill is grounded in real paths (`server/src/platform/container.ts`,
  `server/src/vendor/shared/adapters.ts`, `server/src/modules/repos/*`,
  `server/src/modules/repo-intel/types.ts`, `reviewer-core/src/*`). If those move or
  the layering changes, update the affected reference and bump `version`.
- Bump `version` in `SKILL.md` when the guidance changes materially.
