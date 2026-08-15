# Routing — file globs → DevDigest skills

The authoritative classifier for `pr-self-review`. Given a changed path (and, for
cross-cutting concerns, its diff content), decide which skills review it. A file
gets **one path bucket** plus **zero or more cross-cutting concerns**.

Reasoning behind the buckets: package top-level directory is the reliable
frontend/backend signal — `client/` holds many `.ts` files (hooks, lib, i18n)
that are still frontend, so extension alone is not enough.

## Path buckets

| Bucket | Match | Skills |
| --- | --- | --- |
| **Frontend** | `client/**/*.{tsx,ts,css}` | `frontend-architecture`, `react-best-practices` |
| ↳ Next.js App Router | `client/src/app/**`, any `page.tsx` / `layout.tsx` | + `next-best-practices` |
| ↳ Frontend tests | `client/**/*.test.ts`, `client/**/*.test.tsx`, `client/src/test/**` | `react-testing-library` |
| **Backend** | `server/src/**/*.ts`, `reviewer-core/src/**/*.ts` | `onion-architecture` |
| ↳ Fastify surface | `**/app.ts`, `**/server.ts`, `server/src/platform/**`, module `routes.ts` | + `fastify-best-practices` |
| **Database** | `server/src/db/**`, `server/drizzle.config.ts`, `server/src/db/migrations/**` | `drizzle-orm-patterns`, `postgresql-table-design` |

Notes:
- `reviewer-core/` is BACKEND (the framework-agnostic core) — route to
  `onion-architecture`, never to a Fastify or Drizzle reviewer (it has neither).
- Database files are also backend `.ts`; they get the DB skills instead of a plain
  `onion-architecture` pass unless they also contain service/route logic.

## Cross-cutting concerns (by content, added on top of the path bucket)

| Concern | Signal | Skill |
| --- | --- | --- |
| Security | auth, secrets, input handling, file uploads, API endpoints; paths under `server/src/adapters/auth/**`, `server/src/adapters/secrets/**`, client auth flows | `security` |
| Validation | `z.object`, `z.string`, `safeParse`, `z.infer`, contract/schema files | `zod` |
| General TS | any `.ts` / `.tsx` | `typescript-expert` |

## Anti-scope / de-duplication (do not double-review)

Respect each skill's own anti-scope so two skills don't fight over the same
concern:

- `frontend-architecture` = *where code lives / how it's split*; runtime behavior
  and React anti-patterns → `react-best-practices` only.
- `onion-architecture` = *which layer owns it / dependency direction*; Fastify
  route mechanics → `fastify-best-practices`; Drizzle query syntax →
  `drizzle-orm-patterns`.
- `zod` does not cover React Hook Form or OpenAPI client generation.
- `typescript-expert` is the general-quality backstop — do not use it to restate a
  finding a more specific skill already owns.

## Paths dropped before classification (Step 1)

These are filtered out of the changed-file list in Step 1, so no reviewer ever
sees them:

- `server/clones/**` — cloned external repos (gitignored; never in a real diff).
- `**/node_modules/**`, `**/src/vendor/**`, `pnpm-lock.yaml`, `package-lock.json`.

## Skills that are never per-file reviewers

Not diff paths — these skills are simply never in the routing set:

- `mermaid-diagram` — diagram authoring, not code review.
- `engineering-insights` — a start/end-of-task record workflow, not a lens.
