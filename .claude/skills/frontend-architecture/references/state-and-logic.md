# Where logic and state live

Keep components thin: a component's job is to render. State and business logic have
their own homes.

## Business logic out of component bodies

Two destinations, chosen by whether the logic is React-aware:

- **Custom hooks (`use*`)** — for stateful or effectful logic: data fetching,
  subscriptions, derived UI state, anything using other hooks. Extracting logic into
  a hook names the intent and hides the implementation from the component (React
  docs, "Reusing Logic with Custom Hooks"). A hook must start with `use`; if a good
  `use*` name is hard to find, the logic is probably too coupled to extract cleanly
  yet. Keep hooks focused and high-level — avoid generic "do everything on mount"
  lifecycle wrappers.
- **Plain functions / a service layer** — for pure logic with no React dependency:
  calculations, formatting, validation, domain rules. These are ordinary
  testable functions, colocated with the feature (or shared if truly cross-cutting).

Never inline non-trivial business logic in a component body — it becomes untestable
and re-runs on every render.

## Data fetching belongs in hooks or a data layer

Do data fetching in custom hooks or a dedicated data-access layer, not directly in
component bodies. The container (or the page) handles loading, error, and empty
states; the presentational component just renders the resolved data. In Next.js this
becomes a formal server-only Data Access Layer — see `nextjs-architecture.md`.

## State location: colocate, then lift only as needed

- **Colocate state** with the component that actually uses it. Local state kept
  local is easier to reason about and re-renders less.
- **Lift** state only to the nearest common ancestor that genuinely needs to share
  it — no higher. Over-lifted state causes wide, unnecessary re-renders.
- Do not duplicate the same source of truth across components.

## Derive, don't store; don't sync with effects

The single most important rule for keeping logic in the right place:

- **Derive during render.** If a value can be computed from existing props or state,
  compute it inline instead of storing a copy in `useState`.
- **Do not use `useEffect` to sync derived state.** An effect that reads state and
  writes other state is almost always misplaced derived logic (React docs, "You
  Might Not Need an Effect").
- **Put event logic in the event handler**, not in an effect that reacts to the state
  the handler changed.

Effects are for synchronizing with *external* systems (network, DOM, subscriptions).
Misusing them for derivation or event handling is a top source of accidental
complexity and logic ending up in the wrong place. This overlaps with the
react-best-practices skill's "Derive, Don't Store" and `useEffect` rules — defer
there for the full anti-pattern catalog; here the point is architectural: derived
logic is not state and does not belong in an effect.

## The FSD `model` segment

Feature-Sliced Design names this placement explicitly: within a feature slice, the
`model` segment holds business logic and state, `api` holds data access, `ui` holds
presentation, and `lib` holds local utilities (FSD, "Slices and Segments"). Even
without adopting FSD, the separation — ui / model / api / lib — is a clean way to
think about where each kind of code goes inside a feature.

## Sources

- React docs — Reusing Logic with Custom Hooks: <https://react.dev/learn/reusing-logic-with-custom-hooks>
- React docs — You Might Not Need an Effect: <https://react.dev/learn/you-might-not-need-an-effect>
- patterns.dev — Container/Presentational Pattern (hooks replace containers): <https://www.patterns.dev/react/presentational-container-pattern/>
- Feature-Sliced Design — Slices and Segments: <https://feature-sliced.design/docs/reference/slices-segments>
- Feature-Sliced Design — Layers: <https://feature-sliced.design/docs/reference/layers>
