# reviewer-core (`@devdigest/reviewer-core`) — agent notes

**npm, not pnpm** (own `package-lock.json`). A delta over the root map — read
root `CLAUDE.md` first for the stack and the pnpm/npm split.

## Commands

```sh
npm test           # vitest, hermetic, stubbed LLMProvider — no keys, no network
npm run typecheck  # tsc --noEmit — this IS the build; the package emits no JS
```

## Conventions

- **Purity is the contract.** No database, no GitHub, no filesystem. The only
  side effect is an LLM call through an **injected** `LLMProvider`. Anything that
  needs I/O belongs in `server/`, not here.
- Consumed as TypeScript source through a tsconfig path alias. Never add a build
  step or import from `dist`.
- The public surface is whatever `src/index.ts` exports. Adding an export is an
  API change; check `server/` consumers first.
- Contracts (`Review`, `Finding`, `Verdict`, …) come from `@devdigest/shared`.
- Untrusted content (diffs, PR bodies) must be fenced with `wrapUntrusted()` +
  `INJECTION_GUARD` before it reaches the prompt.

## Gotchas

- **The grounding gate is mandatory.** A finding that does not cite a real line
  in the diff is dropped. Do not add a bypass — it is what stops hallucinated
  locations.
- The score is **recomputed deterministically** from the surviving findings. The
  model's own score is never trusted.
- `assemblePrompt` accepts optional slots (`skills`, `memory`, `specs`,
  `callers`) the starter does not fill. Omitted slots render as no section — an
  empty section means a caller passed an empty value.

## Read when

- **First:** `INSIGHTS.md` — what was already tried and rejected here.
- Pipeline diagram + full public API → `README.md`.
- Changing prompt assembly, grounding, or structured output → `docs/README.md`.
- Adding a prompt slot or a review strategy → `specs/README.md`.
- A built-in agent's system prompt or model choice → `../docs/agent-prompts/`.
- **End of any non-trivial task:** run the `engineering-insights` skill to append
  to `INSIGHTS.md`.
