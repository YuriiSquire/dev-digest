# client (`@devdigest/web`) — agent notes

Next.js 15 App Router + React 19. A delta over the root map — read root
`CLAUDE.md` first for the stack, the pnpm/npm split, and the vendored
do-not-touch zones.

## Commands

```sh
pnpm dev          # next dev, :3000
pnpm build
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest + jsdom, fetch mocked — no API needed
```

## Conventions

- App Router. Pages (`src/app/**/page.tsx`) stay thin; feature logic lives in
  colocated `_components/<Name>/` folders, each with its own `*.test.tsx`.
- All data access goes through a hook in `src/lib/hooks/*`, which calls
  `src/lib/api.ts`. Components never call `fetch` directly.
- Server state is TanStack Query. Do not mirror it into `useState`.
- User-facing strings go through `next-intl` — add them to
  `messages/<locale>/*.json`, never inline literals in JSX.
- Types for API payloads come from `@devdigest/shared`. Do not redeclare them.
- Cross-cutting chrome (nav, breadcrumbs, `g`-then-key shortcuts) lives in
  `src/components/app-shell`.

## Gotchas

- API base is `NEXT_PUBLIC_API_BASE` (default `http://localhost:3001`), read at
  build time — changing `.env` needs a dev-server restart.
- Tests mock `fetch`, so a passing test proves nothing about real API shape. The
  contract is enforced by `@devdigest/shared`; the real journey by `../e2e`.

## Read when

- **First:** `INSIGHTS.md` — what was already tried and rejected here.
- UI route map + which endpoints each page leans on → `README.md`.
- Adding a page or a data hook → `docs/README.md`.
- Designing a new studio screen → `specs/README.md`.
- Needing the exact shape of an endpoint → `../server/README.md`.
- A change that affects a seeded browser flow → `../e2e/README.md`.
- **End of any non-trivial task:** run the `engineering-insights` skill to append
  to `INSIGHTS.md`.
