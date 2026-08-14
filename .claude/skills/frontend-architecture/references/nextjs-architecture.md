# Next.js App Router architecture

Next.js (App Router, v14/15/16) layers two extra axes onto the React organization
rules: a **routing tree** (`app/`) and a **server/client boundary**. Everything in
the other references still applies — this file adds only what Next.js changes.

For framework *file behavior* (`layout`/`page`/`loading`/`error`/`route`, streaming,
metadata) defer to the **next-best-practices** skill. This file covers *where code
lives*.

## Project structure: unopinionated, so apply the same rules

The official docs are explicit that Next.js is **unopinionated** about organization
and only reserves special filenames; `components/` and `lib/` are conventional
placeholders with no framework meaning (Next.js docs, "Project structure and
organization"). Three sanctioned strategies:

1. Keep app code **outside `app/`** — top-level `components/`, `lib/`, etc.
2. Keep it in **top-level folders inside `app/`**.
3. **Split by feature/route**, colocating code with the route that uses it.

Only `page` and `route` files make a route **publicly accessible**; `layout`,
`loading`, `error`, and the like are special *rendering* files, not URLs. **Any
other file is safe to colocate inside a route segment.** Use this to keep
route-specific components next to their route.

Key organizing tools:

- **`src/` folder** — optional; holds application code (including `app/`) separate
  from root config files. Purely organizational (Next.js docs, "src folder").
- **Route groups `(folder)`** — group routes by section/team/intent without affecting
  the URL, and apply a shared or multiple root layouts (Next.js docs, "Route Groups").
- **Private folders `_folder`** — opt a folder out of routing; use `_components/`,
  `_lib/` for route-colocated code that must not become a route.

A common concrete shape (Makerkit; Sentry): shared `components/`, `lib/`, `config/`,
`hooks/`, `types/` at the top level (inside `src/`), route groups like
`(marketing)` / `(app)`, and per-route `_components/` + `_lib/` for code owned by
one route. Promote route-local code to a shared folder only on the second consumer —
the same colocate-then-promote rule as plain React.

## Server / client boundary

Layouts and pages are **Server Components by default**. Opt into a Client Component
only for what needs the browser: state, event handlers, lifecycle/effects, browser
APIs, or hooks that use them (Next.js docs, "Server and Client Components").

Architecture of the boundary (Next.js docs, "The Server and Client Boundary"):

- `"use client"` marks the **entry** to a client subtree. Everything a client module
  imports and renders joins the client bundle — so **push the directive down** to
  small interactive leaves, not large subtrees.
- **Code crosses the boundary via imports** (pulled into the client bundle); **data
  crosses via props** and must be serializable.
- Compose by passing **Server Components as `children`/element props** into Client
  Components, so server-rendered content can nest inside a client wrapper without
  shipping its code to the browser.
- Keep context providers as thin client wrappers rendered as deep as possible.
- Use the `server-only` package to keep server modules (and secrets) from ever being
  imported into client code.

## Where data-fetching and business logic live

The official guidance is to pick **one** data-handling model and not mix them
(Next.js docs, "How to think about data security"; Sebastian Markbåge, "How to Think
About Security in Next.js"):

- **HTTP APIs** — for large orgs with an existing API layer.
- **Data Access Layer (DAL)** — recommended for new projects. A `server-only`
  internal module that centralizes all data fetching, performs auth/authorization,
  and returns minimal **DTOs** (not full records). Only the DAL reads `process.env`.
- **Component-level** — acceptable for prototypes only.

Regardless of model:

- Keep **Server Actions and route handlers thin** — validate input, delegate to the
  DAL/service layer, return a result. Re-verify authentication and authorization
  **inside each action/handler**; do not assume the caller checked.
- A practical pattern is a **service layer** of `*.service.ts` modules holding
  business logic, so Actions/route handlers/webhooks/cron all reuse the same logic
  and stay orchestration-only (Makerkit).

This is the Next.js-specific answer to "where does business logic go": in a
server-only DAL or service layer, behind thin entry points — the same
keep-components-thin principle from `state-and-logic.md`, extended across the
server boundary.

## Constants, utils, types

No Next.js-specific rule — follow `constants-utils-helpers.md`. Shared `config/`
(often Zod-validated), `lib/`, `constants/`, `types/` at the top level; route-specific
values colocated in the route's `_lib/`. Promote when reused.

## Sources

Official docs (primary):

- Project structure and organization: <https://nextjs.org/docs/app/getting-started/project-structure>
- Server and Client Components: <https://nextjs.org/docs/app/getting-started/server-and-client-components>
- The Server and Client Boundary: <https://nextjs.org/docs/app/guides/server-and-client-boundary>
- Directive: use client: <https://nextjs.org/docs/app/api-reference/directives/use-client>
- Route Groups: <https://nextjs.org/docs/app/api-reference/file-conventions/route-groups>
- src folder: <https://nextjs.org/docs/app/api-reference/file-conventions/src-folder>
- Project Organization (colocation), v14: <https://nextjs.org/docs/14/app/building-your-application/routing/colocation>
- How to think about data security in Next.js: <https://nextjs.org/docs/app/guides/data-security>

Practitioner (secondary — treat as informal):

- Sebastian Markbåge — How to Think About Security in Next.js: <https://nextjs.org/blog/security-nextjs-server-components-actions>
- Makerkit — Next.js App Router Project Structure: <https://makerkit.dev/blog/tutorials/nextjs-app-router-project-structure>
- Lee Robinson — How I structure my Next/React apps (thread): <https://x.com/leerob/status/1827522336007799123>
- Sentry — Next.js directory organization best practices: <https://sentry.io/answers/next-js-directory-organisation-best-practices/>
