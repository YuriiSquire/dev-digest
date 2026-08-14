# Component decomposition

When to split a component into smaller ones, how to decide the boundaries, and the
modern form of the container/presentational pattern.

## Derive structure from the model, one responsibility each

Build the component tree from the UI and its underlying data model, and give each
component a single responsibility — ideally it does one thing, and when it grows it
is decomposed into subcomponents (React docs, "Thinking in React"). The same
heuristic used to decide whether to extract a function applies to components: if a
piece has a clear, nameable job of its own, it can be its own component.

## Split for a real reason, not by line count

A line threshold is a weak signal. Extraction should be driven by an actual problem
being experienced, not by size for its own sake — and not prematurely (Kent C.
Dodds, "When to Break Up a Component"). Concretely, break a component up when:

- **A part needs to be reused** elsewhere — the clearest reason to extract it.
- **The component has genuinely grown to do too much**, so working with the whole is
  harder than working with the pieces would be.
- **A subtree owns state that changes often** and isolating it would contain the
  re-renders.

Do **not** split just because a file is long, or purely in the name of "separation
of concerns" — premature extraction adds indirection without solving a problem.
Duplication is cheaper than the wrong abstraction (Sandi Metz, quoted by Dodds); when
unsure, wait until a second use or a concrete pain point appears.

## Too many props is a smell

A component that needs many props — roughly 5–7+, or several booleans that toggle
unrelated behavior — is usually doing too much: it has drifted into an
over-configurable "god component" (TkDodo, "Component Composition is Great btw").
Options, in order of preference:

1. **Compose** smaller focused components instead of configuring one large one.
2. Pass **`children` / slots** so the parent supplies content rather than the
   component branching on flags.
3. Occasionally, split into two purpose-built components rather than adding yet
   another prop — duplication can beat a component that tries to be everything.

## Composition over configuration

Composition — passing `children` and element props — keeps markup, styles, and
logic that belong together in one place while avoiding prop-drilling and
"god components" that accept a config object for every variation (TkDodo,
"Component Composition is Great btw"). Separation of concerns is about *where* you
draw the line, not *whether* to keep related things together: a component's JSX,
its styles, and its local logic naturally belong in the same unit.

## Container / presentational → hooks

The classic pattern (Dan Abramov, 2015) split components in two:

- **Presentational** — how things look; receives props, holds no data logic.
- **Container** — what data is shown; fetches and holds logic.

Treat this as **historical context**: Abramov himself later de-emphasized it. The
modern equivalent is that **custom hooks replaced the container** (patterns.dev,
"Container/Presentational Pattern"). Logic moves into a `use*` hook; the component
stays presentational and simply renders what the hook returns. This keeps the split
(logic vs presentation) without the extra wrapper component the old pattern added.

```
// modern shape
function useCheckout() { /* state, effects, data, business logic */ }

function Checkout() {
  const { items, total, submit } = useCheckout();
  return /* presentation only */;
}
```

## Atomic Design as a component-library lens

For a **design system / shared component library**, Atomic Design (Atoms →
Molecules → Organisms → Templates → Pages) is a useful mental model for the whole
and its reusable parts (Brad Frost). It applies to the shared UI layer, not to
feature decomposition — many teams keep a flat `components/ui/` rather than adopting
the tiers literally.

## Sources

- React docs — Thinking in React: <https://react.dev/learn/thinking-in-react>
- Kent C. Dodds — When to Break Up a Component Into Multiple Components: <https://kentcdodds.com/blog/when-to-break-up-a-component-into-multiple-components>
- Dan Abramov — Presentational and Container Components (historical): <https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0>
- patterns.dev — Container/Presentational Pattern: <https://www.patterns.dev/react/presentational-container-pattern/>
- TkDodo — Component Composition is Great btw: <https://tkdodo.eu/blog/component-composition-is-great-btw>
- Atomic Design — Chapter 2: <https://atomicdesign.bradfrost.com/chapter-2/>
