---
name: frontend-architecture
version: 0.1.0
description: >-
  This skill should be used when structuring a React or Next.js frontend and
  deciding WHERE code should live and HOW it should be split — "where should
  this component go", "how do I break up this component", "where do constants /
  types / utils / helpers belong", "where should business logic live", "how
  should I organize the folders", feature-based vs type-based structure,
  colocation, barrel files, path aliases, Feature-Sliced Design, bulletproof-react,
  Atomic Design, and Next.js App Router structure (app/ vs src/, route groups,
  private _folders, the "use client" boundary, data-access/service layer). Use it
  whenever starting a new feature or app, or reviewing frontend organization —
  even if the user never says the word "architecture". Scope is organization and
  architecture, NOT runtime performance or React anti-patterns (for those, defer
  to the react-best-practices skill).
---

# Frontend Architecture (React + Next.js)

Answer the recurring "where does this go?" questions for a React or Next.js
codebase: where components live, how to split them, where constants, types,
utils, helpers, hooks, and business logic belong, and how folders should be
organized so the codebase scales without turning into a tangle.

This skill covers **organization and architecture only**. It deliberately does
not cover runtime performance, memoization, or React anti-patterns — those are a
different concern with a different owner (see *Related skills* below). Keep the
two separate so neither skill has to repeat the other.

## How to use this skill

Start from the core principles, then open the one reference file that matches the
decision at hand. Each reference is self-contained and cites its sources.

| Question | Reference |
| --- | --- |
| How should folders be organized? feature vs type, colocation, `src/`, aliases, barrels | `references/folder-structure.md` |
| When and how do I split a component? | `references/component-decomposition.md` |
| Where does business logic and state live? | `references/state-and-logic.md` |
| Where do constants, types, utils, helpers, and hooks go? | `references/constants-utils-helpers.md` |
| How do I structure a Next.js App Router app? | `references/nextjs-architecture.md` |

Every source used to build this skill — with links — is listed in `README.md`.

## Core principles

These five ideas resolve most placement questions. When a specific rule below
feels ambiguous, fall back to the principle behind it.

- **Colocate by default.** Put code as close as possible to where it is used — a
  component's hook, helpers, styles, and test belong beside it, not in a distant
  `hooks/` or `utils/` bucket. Colocation makes code easier to find, safer to
  change, and trivial to delete or move (drag the folder). Reach for a shared
  location only once something is genuinely used in more than one place.

- **Organize by feature, not by file type.** Group code by what it *does* (the
  business domain — `checkout/`, `search/`), not by what it technically *is*
  (`components/`, `hooks/`, `utils/`). Type-based folders scatter related code so
  a single change touches five directories; feature folders keep a change local.

- **Let dependencies flow one direction.** Shared/generic code must not import
  feature code, and features should not import each other — cross-feature
  composition happens one layer up (the app/page). One-way dependencies are what
  keep coupling low as the app grows; enforce them with lint rules, not vigilance.

- **Extract on the second use, not the first.** A component, hook, or util with a
  single caller is usually a premature abstraction — inline it and wait. Duplication
  is cheaper than the wrong abstraction. Let structure grow with the app instead of
  designing a deep folder tree on day one.

- **Push boundaries down.** Keep state in the smallest subtree that needs it, and
  in Next.js keep the `"use client"` boundary on small interactive leaves rather
  than large subtrees. Boundaries placed high pull in more code and cause more
  re-rendering than boundaries placed at the leaves.

## Folder structure

Decide the organizing axis first, then let it evolve. Full guidance, example
trees, and the barrel-file trade-off are in `references/folder-structure.md`.

- Start small and add structure only as the app grows: single file → component
  folder → grouped features. Do not scaffold `features/`, `entities/`, `widgets/`
  on day one.
- Split code into two buckets: **shared/generic** (design-system UI, cross-cutting
  utils) and **feature-specific** (everything owned by one domain). Promote from
  feature to shared only on the second consumer.
- Prefer absolute imports via a path alias (`@/…`) over deep `../../../` chains.
- Treat `index.ts` barrel files with caution — they cause circular-dependency and
  build/tree-shaking problems at scale. See the reference for when they are worth it.
- For a formal, enforceable convention on a large app, adopt a named methodology
  (Feature-Sliced Design or bulletproof-react) rather than inventing one.

## Component decomposition

Split for separation of concerns, not to hit a line count. Details and the
container-vs-hook evolution are in `references/component-decomposition.md`.

- Derive component structure from the data/UI model, and give each component a
  single responsibility. Split when a component owns two unrelated concerns.
- Keep rendering (presentational) separate from data and logic. The modern form of
  the old "container/presentational" split is: logic lives in a **custom hook**,
  the component renders what the hook returns.
- Prefer composition (`children`, slots) over adding another prop. A component with
  too many props (roughly 5–7+) or booleans that toggle unrelated behavior is doing
  too much — compose smaller pieces instead of configuring one large one.

## Where logic and state lives

Keep components thin. Full guidance in `references/state-and-logic.md`.

- Business logic belongs in **custom hooks** (stateful/effectful logic) or plain
  **functions/services** (pure logic), never inline in a component body.
- Do data fetching in hooks or a data-access layer, not in component bodies.
- Colocate state with the component that uses it; lift only as high as the nearest
  common ancestor that truly needs it.
- Derive values during render instead of storing them in state or syncing them with
  an effect — misplaced `useEffect` logic is a top source of accidental complexity.

## Constants, utils, and helpers

Placement follows the same colocate-then-promote rule. Details in
`references/constants-utils-helpers.md`.

- Feature-specific constants/types/utils live inside that feature; only genuinely
  shared ones move to a top-level `constants/`, `types/`, or `lib`/`utils/`.
- Extract magic values and static arrays/objects to named module-level constants.
- Distinguish the kinds of extracted code: **pure function** → util/helper;
  **stateful/React-aware logic** → `use*` hook. If a `use*` name is hard to choose,
  the logic is probably too coupled to split yet.

## Next.js architecture

Next.js adds a server/client axis and a routing tree on top of the above. Full
guidance in `references/nextjs-architecture.md`.

- Next.js is unopinionated about organization; the same feature/colocation rules
  apply. Only `page` and `route` files make a route publicly accessible
  (`layout`/`loading`/`error` are special rendering files) — everything else is
  safe to colocate inside a route segment (use a private `_components/` folder) or
  hoist to a shared top-level folder.
- Keep components as Server Components by default; add `"use client"` only on the
  interactive leaves that need state, effects, or browser APIs.
- Centralize data access and business logic in a server-only **Data Access Layer**
  or **service layer**; keep Server Actions and route handlers thin, delegating to
  it and re-checking authorization inside each entry point.

## Decision heuristics

A quick cheat sheet when unsure:

- **Where does X go?** → beside its only consumer; promote to shared on the second.
- **Type-based or feature-based folder?** → feature-based once there is more than
  one feature.
- **Split this component?** → only if it holds two responsibilities or mixes data
  with presentation.
- **Hook or util?** → touches React state/effects/context → hook; otherwise a pure
  util.
- **Server or Client Component (Next.js)?** → Server unless it needs interactivity,
  then mark the smallest leaf `"use client"`.

## Related skills

- **react-best-practices** — the rules/anti-pattern catalog (Derive-Don't-Store,
  `useEffect` misuse, render factories, memoization, keys, performance). Defer to
  it for *what not to do inside a component*; this skill owns *where code lives*.
- **next-best-practices** — Next.js framework file conventions and RSC mechanics
  (`layout`/`page`/`loading`/`error`, streaming, metadata). Defer to it for
  framework-file behavior; this skill owns the *organizational* decisions.

## Sources

All references, with links, author, and a one-line takeaway, are catalogued in
`README.md`. Every claim in this skill traces to a source there; do not add
guidance here without a citation.
