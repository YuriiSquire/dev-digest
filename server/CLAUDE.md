# server (`@devdigest/api`) — agent notes

Fastify 5 + Drizzle/Postgres. A delta over the root map — read root `CLAUDE.md`
first; it owns the stack, the pnpm/npm split, and the shared do-not-touch zones.

## Commands

```sh
pnpm dev                                    # tsx watch, :3001
pnpm typecheck                              # tsc --noEmit
pnpm test                                   # everything
pnpm exec vitest run --exclude '**/*.it.test.ts'   # hermetic units only
pnpm exec vitest run .it.test                      # DB-backed only
pnpm db:generate && pnpm db:migrate         # schema change → migration → apply
pnpm db:seed                                # idempotent demo data
```

## Conventions

- One feature = one `src/modules/<name>/` plugin, registered statically in
  `src/modules/index.ts` (one import + one `app.register`).
- Routes declare Zod `params`/`body`/response schemas from `@devdigest/shared`
  via `fastify-type-provider-zod` — invalid input is rejected `422` **before** the
  handler runs. Never hand-roll `Schema.parse(req.body)`.
- Plugins (helmet, cors, rate-limit, SSE) register **before** modules so module
  plugins inherit them and the shared error handler.
- External I/O goes through an adapter behind the DI container
  (`src/platform/container.ts`); tests swap in `src/adapters/mocks.ts`.
- Schema change = edit `src/db/schema.ts` → `pnpm db:generate`. Migrations are
  generated + append-only; never hand-write, edit, or delete one (it desyncs the
  SQL, `meta/*_snapshot.json`, and `_journal.json`).
- Secrets are read only through `LocalSecretsProvider`
  (`src/adapters/secrets/local.ts`). `GITHUB_TOKEN` is canonical; `GITHUB_PAT` a fallback.

## Gotchas

- Migrations are **not** applied on boot — `relation ... does not exist` means you
  skipped `pnpm db:migrate`.
- `loadConfig` marks every secret optional — a missing key surfaces at call time,
  not at startup.
- The DB schema already contains every table, including ones no starter code
  writes to. An empty table is expected, not a bug.
- The engine reaps orphaned `running` runs on boot — a stuck run is usually a
  crashed process, not a logic bug.

## Read when

- **First:** `INSIGHTS.md` — what was already tried and rejected here.
- API map + request/DI flow diagram + env table → `README.md`.
- Touching a route, a DI adapter, or the DB schema → `docs/README.md`.
- Touching indexing or the repo map → `src/modules/repo-intel/README.md` and its
  `CLAUDE.md`.
- Adding a new `modules/<name>/` plugin → `specs/README.md`.
- Adding a test or changing the unit-vs-integration split → `../TESTING.md`.
- **End of any non-trivial task:** run the `engineering-insights` skill to append
  to `INSIGHTS.md`.
