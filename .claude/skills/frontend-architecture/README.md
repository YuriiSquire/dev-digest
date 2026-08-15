# frontend-architecture — skill

A curated skill capturing **React + Next.js frontend architecture** best
practices — the *organizational* questions (where code lives, how components are
split, where constants / types / utils / helpers / business logic belong, how
folders are organized), **not** runtime performance. Version `0.1.0`.

- Entry point: [`SKILL.md`](./SKILL.md) — core principles + per-topic decision rules.
- Depth: [`references/`](./references) — one self-contained file per question.

## Scope and relation to other skills

This skill owns *where code lives and how it is organized*. It deliberately does not
duplicate:

- **react-best-practices** — the rules/anti-pattern catalog (Derive-Don't-Store,
  `useEffect` misuse, memoization, keys, performance).
- **next-best-practices** — Next.js framework file conventions and RSC mechanics.

`SKILL.md` cross-references both instead of restating them.

## Reference files

| File | Covers |
| --- | --- |
| `references/folder-structure.md` | feature vs type-based, colocation, `src/`, path aliases, barrel files, FSD / bulletproof-react / Atomic Design |
| `references/component-decomposition.md` | when/how to split, container→hooks, composition, single-responsibility |
| `references/state-and-logic.md` | business logic in hooks/services, state location, derive-don't-store |
| `references/constants-utils-helpers.md` | constants, utils vs helpers vs hooks, types placement, naming |
| `references/nextjs-architecture.md` | `app/` vs `src/`, route groups, private folders, server/client boundary, DAL / service layer |

## Sources

Every claim in the skill traces to one of the sources below. All URLs and titles
were verified during research (Aug 2026). Do not add guidance to the skill without a
citation here.

### React architecture & organization

**Methodologies / reference architectures**

1. **bulletproof-react — Project Structure** — Alan Alickovic — <https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md>
   Feature-based `src/features/<feature>` self-contained folders; unidirectional import flow `shared → features → app`.
2. **bulletproof-react — Project Standards** — Alan Alickovic — <https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md>
   Enforcement: ESLint `import/no-restricted-paths`, absolute imports/aliases, naming discipline.
3. **Feature-Sliced Design — Overview** — FSD community — <https://feature-sliced.design/docs/get-started/overview>
   Layers → Slices → Segments methodology.
4. **Feature-Sliced Design — Layers** — FSD — <https://feature-sliced.design/docs/reference/layers>
   Per-layer rules and the import-direction constraint.
5. **Feature-Sliced Design — Slices and Segments** — FSD — <https://feature-sliced.design/docs/reference/slices-segments>
   Segments (`ui`/`api`/`model`/`lib`/`config`) = where constants/utils/logic go inside a slice.
6. **Atomic Design — Chapter 2** — Brad Frost, 2016 — <https://atomicdesign.bradfrost.com/chapter-2/>
   Atoms → Molecules → Organisms → Templates → Pages; a design-system lens.

**Component decomposition & composition**

7. **Thinking in React** — React team — <https://react.dev/learn/thinking-in-react>
   Derive component structure from the data model; single-responsibility split.
8. **When to Break Up a Component Into Multiple Components** — Kent C. Dodds, 2020 — <https://kentcdodds.com/blog/when-to-break-up-a-component-into-multiple-components>
   Break components up for a real reason (reuse, or genuinely doing too much), not by line count or prematurely; duplication beats the wrong abstraction.
9. **Presentational and Container Components** — Dan Abramov, 2015 *(historical — author later de-emphasized)* — <https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0>
   Origin of the container/presentational split.
10. **Container/Presentational Pattern** — patterns.dev — <https://www.patterns.dev/react/presentational-container-pattern/>
    Modern take: custom hooks replaced the "container".
11. **Component Composition is Great btw** — TkDodo, 2023 — <https://tkdodo.eu/blog/component-composition-is-great-btw>
    Composition/`children` over configurable god-components.

**Folder structure, colocation, files**

12. **Colocation** — Kent C. Dodds, 2019 — <https://kentcdodds.com/blog/colocation>
    Keep code as close as possible to where it is used.
13. **The Vertical Codebase** — TkDodo, 2023 — <https://tkdodo.eu/blog/the-vertical-codebase>
    Feature (vertical) vs type-based (horizontal) folders.
14. **Delightful React File/Directory Structure** — Josh W. Comeau, 2020 — <https://www.joshwcomeau.com/react/file-structure/>
    Per-component folders, colocated hooks/helpers, `index.js` barrels, path aliases; flat function-based organization.
15. **React Folder Structure Best Practices [2026]** — Robin Wieruch — <https://www.robinwieruch.de/react-folder-structure/>
    Staged evolution: single file → component folders → feature folders.
16. **Feature-based React Architecture** — Robin Wieruch — <https://www.robinwieruch.de/react-feature-architecture/>
    Decoupled features owning their components and data.

**Business logic, hooks, utils, imports**

17. **Reusing Logic with Custom Hooks** — React team — <https://react.dev/learn/reusing-logic-with-custom-hooks>
    Extract stateful/effectful logic into `use*` hooks.
18. **You Might Not Need an Effect** — React team — <https://react.dev/learn/you-might-not-need-an-effect>
    Derive during render; event logic in handlers, not effects.
19. **Please Stop Using Barrel Files** — TkDodo, 2024 — <https://tkdodo.eu/blog/please-stop-using-barrel-files>
    `index.ts` barrels cause circular deps, slow builds, broken tree-shaking.

### Next.js App Router architecture

**Official docs (primary authority)**

20. **Project structure and organization** — Next.js/Vercel — <https://nextjs.org/docs/app/getting-started/project-structure>
    Three sanctioned strategies; safe colocation; route groups, private folders, optional `src/`.
21. **Server and Client Components** — Next.js — <https://nextjs.org/docs/app/getting-started/server-and-client-components>
    Server by default; push `"use client"` to leaves; pass Server Components as children.
22. **The Server and Client Boundary** — Next.js — <https://nextjs.org/docs/app/guides/server-and-client-boundary>
    Code crosses via imports, data via serializable props; boundary at subtree entry.
23. **Directive: use client** — Next.js — <https://nextjs.org/docs/app/api-reference/directives/use-client>
    Formal boundary/serialization reference.
24. **Route Groups** — Next.js — <https://nextjs.org/docs/app/api-reference/file-conventions/route-groups>
    Organize routes without affecting the URL; shared/multiple layouts.
25. **src folder** — Next.js — <https://nextjs.org/docs/app/api-reference/file-conventions/src-folder>
    Optional `src/` for app code vs root config.
26. **Project Organization (colocation), v14** — Next.js — <https://nextjs.org/docs/14/app/building-your-application/routing/colocation>
    Version-pinned colocation / private-folders citation.
27. **How to think about data security in Next.js** — Next.js — <https://nextjs.org/docs/app/guides/data-security>
    HTTP APIs vs Data Access Layer vs component-level; DAL is server-only, returns DTOs, owns auth; thin Server Actions.
28. **How to Think About Security in Next.js (blog)** — Sebastian Markbåge, 2023 — <https://nextjs.org/blog/security-nextjs-server-components-actions>
    Origin and rationale of the DAL/DTO pattern.

**Practitioner / community (secondary — treat as informal)**

29. **Next.js App Router Project Structure: The Definitive Guide** — Makerkit, 2024 — <https://makerkit.dev/blog/tutorials/nextjs-app-router-project-structure>
    Concrete structure: `config/` (Zod), `lib/`, route groups, `.service.ts` service layer + thin Server Actions.
30. **How I structure my Next/React apps (thread)** — Lee Robinson, 2024 — <https://x.com/leerob/status/1827522336007799123>
    Practitioner viewpoint (social thread — informal).
31. **Next.js directory organization best practices** — Sentry — <https://sentry.io/answers/next-js-directory-organisation-best-practices/>
    Layer vs feature vs hybrid; shared `hooks`/`lib`/`constants`/`types` at top level, colocate route-specific, promote when reused.

### Accuracy notes

- **#9 (Abramov)** carries the author's own later disclaimer — presented as history;
  current practice defers to #10 and #17.
- **#30 (Lee Robinson X thread)** and **#31 (Sentry)** came from search results, not a
  full page fetch — treated as informal/secondary.
- Official-docs pages are living documents; the URLs are stable and the guidance
  applies to Next.js 14/15/16 App Router. Only #26 is version-pinned (`/docs/14/`).

## Authoring notes

- Structure and frontmatter follow the repo's skill conventions (see `zod/`,
  `drizzle-orm-patterns/`) and the official skill-authoring guides
  (`plugin-dev/skills/skill-development`, `skill-creator`): a lean `SKILL.md` index
  with depth in `references/`, third-person "pushy" description, `version` field,
  imperative body style.
- Bump `version` in `SKILL.md` when the guidance changes materially.
