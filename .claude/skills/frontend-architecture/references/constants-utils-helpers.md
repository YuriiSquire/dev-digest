# Constants, utils, helpers, types

Where the small supporting pieces go. The rule is the same colocate-then-promote
logic used for everything else.

## Constants

- **Extract magic values.** Replace inline literals — status strings, limits, static
  arrays/objects used in JSX — with named, module-level constants. This gives them a
  name and a single definition, and (for static arrays/objects) avoids recreating a
  new reference on every render.
- **Placement follows ownership.** A constant used by one feature lives in that
  feature (e.g. `checkout/constants.ts` or beside the file that uses it). Only
  genuinely app-wide constants move to a shared top-level `constants/` (or the FSD
  `config` segment). Do not create a global `constants/` dumping ground for values
  that belong to one feature.
- **Reuse before creating.** Prefer an existing constant/enum over introducing a
  parallel one.

## Utils vs helpers vs hooks

These names get blurred; the meaningful distinction is React-awareness:

- **Pure function (util / helper)** — no React, no state, no side effects: same input
  → same output. Formatting, parsing, math, predicates. Put it in the feature's
  `utils`/`lib`, or a shared `utils/` only if used across features.
- **`use*` hook** — anything that touches React state, effects, context, or other
  hooks. If the logic needs `useState`/`useEffect`/`useContext`, it is a hook, not a
  util (React docs, "Reusing Logic with Custom Hooks").

There is no strong semantic difference between "utils" and "helpers" — pick one name
per codebase and be consistent. What matters is that pure logic and React-aware logic
do not get mixed in the same module.

## Types

- Colocate feature-specific types with the feature (or the file that owns them);
  hoist to a shared `types/` only when more than one feature needs them (Sentry,
  "Next.js directory organization best practices").
- Types describing an API response often live beside the data-access code that
  returns them.

## Colocate first, promote on the second use

For every one of these — constant, util, helper, type — start it inside the feature
that needs it and promote to a shared location only when a second consumer appears
(Kent C. Dodds, "Colocation"; Robin Wieruch). Premature promotion produces a shared
folder full of single-use items that are effectively feature code in the wrong place.

## Keep pure logic out of components

Helper functions belong at module level (or in a util module), never redefined
inside a component body — an in-body helper is recreated every render and cannot be
tested in isolation. Extract it beside the component or into the feature's utils.

## Sources

- React docs — Reusing Logic with Custom Hooks: <https://react.dev/learn/reusing-logic-with-custom-hooks>
- Feature-Sliced Design — Slices and Segments: <https://feature-sliced.design/docs/reference/slices-segments>
- Josh W. Comeau — Delightful React File/Directory Structure: <https://www.joshwcomeau.com/react/file-structure/>
- Robin Wieruch — React Folder Structure Best Practices: <https://www.robinwieruch.de/react-folder-structure/>
- bulletproof-react — Project Standards: <https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md>
- Sentry — Next.js directory organization best practices: <https://sentry.io/answers/next-js-directory-organisation-best-practices/>
