# e2e (`@devdigest/e2e`) — agent notes

**npm, not pnpm** (own `package-lock.json`). A delta over the root map — read
root `CLAUDE.md` first for the stack and the pnpm/npm split.

## Commands

```sh
npm i -g agent-browser && agent-browser install   # once — downloads Chrome for Testing
npm run e2e:hermetic    # RECOMMENDED: isolated seeded stack (:5433/:3101/:3100)
npm test                # runs flows against whatever is on E2E_BASE_URL
npm run typecheck
```

## Conventions

- A flow is `specs/NN-name.flow.json`: a JSON list of agent-browser commands run
  in order against one shared browser session by `run.ts`.
- `{BASE}` is substituted with `E2E_BASE_URL` (default `http://localhost:3000`).
- **`wait --text` / `wait --url` are the assertions** — they exit non-zero on
  timeout. Optional `"assert": { "stdoutIncludes": … }` adds a stdout check.
- **Deterministic locators only**: `--url`, `--text`, `find role|text|label`.
  Never use the AI `chat` command — runs must stay stable and key-free.
- Flows target read-only seeded data (`acme/payments-api`, PR #482, seeded
  agents) so nothing triggers a model call. Do not add a flow that writes.

## Gotchas

- **Flows assume a freshly-seeded DB with exactly one repo.** Flow `02` follows
  the home redirect to the *first* repo, so plain `npm test` against your dev DB
  (which has other imported repos) fails flows 02/04/05. Use `npm run e2e:hermetic`
  — it exists precisely so you never touch the dev DB (nor need `down -v`; see root).
- This is a CLI wrapper, not a test framework: a failing step fails the flow with
  the raw agent-browser exit, so read stderr rather than expecting a matcher diff.

## Read when

- **First:** `INSIGHTS.md` — what was already tried and rejected here.
- Flow format + full hermetic-runner walkthrough → `README.md`.
- Prose specs for this package → `docs/README.md` (`specs/` holds executable
  `*.flow.json`, so prose lives in `docs/`).
- Adding a new `NN-name.flow.json` → `specs/README.md`.
- A flow breaks after a UI route change → `../client/README.md`.
- Where this suite sits in the overall strategy → `../TESTING.md`.
- **End of any non-trivial task:** run the `engineering-insights` skill to append
  to `INSIGHTS.md`.
