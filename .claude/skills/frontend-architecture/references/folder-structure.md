# Folder structure

How to organize directories so a frontend scales without related code drifting
apart. Covers the organizing axis, how structure should evolve, the shared vs
feature split, path aliases, barrel files, and the named methodologies.

## Organize by feature, not by file type

Two axes exist for top-level folders:

- **Type-based (horizontal):** `components/`, `hooks/`, `utils/`, `types/`,
  `constants/`. Groups code by what it technically *is*.
- **Feature-based (vertical):** `checkout/`, `search/`, `profile/`, each folder
  owning its own components, hooks, utils, and types. Groups code by what it *does*.

Prefer feature-based once the app has more than one feature. Type-based folders
scatter code that changes together: renaming a checkout field can touch
`components/`, `hooks/`, `utils/`, and `types/` at once, and `useTheme` ends up far
from the `ThemeProvider` it belongs to. Feature folders keep a change local and let
a whole feature be deleted or moved as one unit ("The Vertical Codebase", TkDodo).

## Let structure grow — do not over-scaffold

Structure should evolve with the app, not be designed in full on day one (Robin
Wieruch, "React Folder Structure Best Practices"):

1. Single component file.
2. Multiple files (component + test + styles).
3. A **component folder** — the component, its colocated `useX` hook, its
   `X.helpers.ts`, its test, and (optionally) an `index.ts`.
4. Group component folders by **feature** once several relate to one domain.
5. Only a large app needs the full layered tree of a formal methodology.

Do not start at step 5. A deep `features/entities/widgets/` tree around a handful
of components is premature and adds ceremony without payoff.

## The shared vs feature split

Sort every module into one of two buckets:

- **Shared / generic** — design-system UI (`components/ui/`), cross-cutting utils,
  app-wide config. Has no knowledge of any feature.
- **Feature-specific** — components, hooks, utils, constants, and types owned by a
  single domain, colocated under that feature.

Default new code to the feature it serves. **Promote to shared only on the second
consumer** — a "shared" helper with one caller is just a misplaced feature helper.

## Dependencies flow one direction

Coupling is controlled by import direction, not discipline (bulletproof-react,
"Project Structure"):

- Shared code must not import feature code.
- Features must not import each other; compose them one layer up (the app/page).

This yields a unidirectional graph (`shared → features → app`) that keeps the
codebase decomposable as it grows. Enforce it mechanically with ESLint
`import/no-restricted-paths` rather than relying on reviewers to catch violations
(bulletproof-react, "Project Standards").

## Path aliases over deep relative imports

Configure an absolute-import alias (`@/features/checkout/…`) via `tsconfig.json`
`paths` (and the bundler). Prefer it over `../../../` chains: aliased imports do not
break when a file moves and read more clearly (Josh Comeau, "Delightful React
File/Directory Structure"; bulletproof-react "Project Standards").

## Barrel files (`index.ts`) — use sparingly

A barrel re-exports a folder's public surface so consumers import from the folder
rather than deep paths. It reads nicely, but at scale it causes real problems
(TkDodo, "Please Stop Using Barrel Files"):

- **Circular dependencies** — modules importing through the same barrel reference
  each other.
- **Slower builds and tests** — importing one symbol pulls the whole barrel's
  module graph.
- **Broken tree-shaking** — bundlers struggle to drop unused re-exports.

Guidance: import from source modules (with path aliases) by default. Reserve a
barrel for a small, stable public API of a shared package/module — not for every
feature or component folder. This is a genuine trade-off; Comeau's per-component
`index.js` convention is fine for a small app, while TkDodo's caution matters more
as the codebase grows.

## Named methodologies (for large, formal codebases)

When a convention needs to be explicit and enforceable across a team, adopt an
established one instead of inventing a house style:

- **bulletproof-react** — pragmatic, feature-first. Most code lives under
  `src/features/<feature>`, each feature self-contained with its own `api/`,
  `components/`, `hooks/`, `stores/`, `types/`, `utils/`. Strong emphasis on the
  unidirectional import rule and lint enforcement. A good default for most React
  apps.
- **Feature-Sliced Design (FSD)** — a stricter, layered standard. Three tiers:
  **Layers → Slices → Segments**. Layers (`app`, `pages`, `widgets`, `features`,
  `entities`, `shared` — a 7th, `processes`, is deprecated) rank code by
  responsibility; a module may import only from
  layers strictly below it, and slices on the same layer cannot import each other.
  Segments (`ui`, `api`, `model`, `lib`, `config`) standardize *where within a slice*
  each kind of code lives. Best for large apps that need a formal, tool-checkable
  structure.
- **Atomic Design** — Atoms → Molecules → Organisms → Templates → Pages. A mental
  model for a **component library / design system**, not a whole-app folder scheme.
  Useful for organizing the shared UI layer; less suited to feature organization,
  and some practitioners prefer a flat `components/ui/` over its tiers.

## Recommended default

For a typical React or Next.js app: a feature-first structure (bulletproof-react
style) with `src/`, per-component folders inside features, a shared `components/ui/`
for the design system, path aliases, one-directional imports enforced by lint, and
barrels used only for stable shared APIs. Reach for full FSD only when the team
needs its formality.

## Sources

- bulletproof-react — Project Structure: <https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md>
- bulletproof-react — Project Standards: <https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md>
- Feature-Sliced Design — Overview: <https://feature-sliced.design/docs/get-started/overview>
- Feature-Sliced Design — Layers: <https://feature-sliced.design/docs/reference/layers>
- Feature-Sliced Design — Slices and Segments: <https://feature-sliced.design/docs/reference/slices-segments>
- Atomic Design — Chapter 2: <https://atomicdesign.bradfrost.com/chapter-2/>
- Kent C. Dodds — Colocation: <https://kentcdodds.com/blog/colocation>
- TkDodo — The Vertical Codebase: <https://tkdodo.eu/blog/the-vertical-codebase>
- Josh W. Comeau — Delightful React File/Directory Structure: <https://www.joshwcomeau.com/react/file-structure/>
- Robin Wieruch — React Folder Structure Best Practices: <https://www.robinwieruch.de/react-folder-structure/>
- Robin Wieruch — Feature-based React Architecture: <https://www.robinwieruch.de/react-feature-architecture/>
- TkDodo — Please Stop Using Barrel Files: <https://tkdodo.eu/blog/please-stop-using-barrel-files>
