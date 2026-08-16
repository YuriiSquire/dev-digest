# Conventions Extractor

**Status:** draft
**Packages touched:** server, `@devdigest/shared`, client

## Problem

Every repo carries unwritten house rules — "public route handlers return
`Result<T, ApiError>`", "Redis access goes through the `src/lib/redis.ts`
singleton", "async/await, never `.then()` chains". New contributors and review
agents don't know them until they break one. Claude Code surfaces similar
project rules from chat history under `/insights`; DevDigest should surface them
from the *repo itself* and let a human promote the good ones into a reusable
review skill.

The hard part is trust. A model asked to "list this repo's conventions" will
confidently invent rules and cite files that don't exist. So the model's output
is treated as **unverified candidates**: every candidate must be proven against
the real project files *in code* before a human ever sees it, and the human still
accepts/rejects each one before anything becomes a skill.

## Scope — in / out

**In**
- A **Conventions** screen (Skills Lab) that lists detected convention candidates
  for the active repo, each with its rule, evidence (`file:line` + snippet), and a
  confidence bar.
- **Re-scan** — run extraction on demand.
- Per-candidate **accept / reject** and **edit** (rule / category / evidence).
- **Create skill from conventions** — bundle the accepted candidates into one
  editable `convention`-type skill (name, description, type, enabled, markdown
  body with a live token count), saved to Skills Lab.
- **Code-verified evidence:** candidates whose cited file or snippet cannot be
  found in the repo are dropped before display — no model involved in that check.

**Out (this iteration)**
- **Agent binding is not part of this feature's UI.** The created skill is bound
  to an agent afterward with the *existing* Agent-editor skill-linking flow
  (`POST /agents/:id/skills`); we reuse it, we don't rebuild it.
- **Multiple / grouped skills** from one accepted set — this iteration produces a
  single bundled skill (matches the design). Splitting by category is deferred.
- Auto-applying or enforcing conventions during PR review (a convention becomes a
  normal skill; how skills feed the review prompt is unchanged and out of scope).
- Convention diffing across scans / history beyond "last scan replaces previous".

## Contract changes        <!-- @devdigest/shared first, always -->

`@devdigest/shared` (`contracts/knowledge.ts`) — edit **both** vendored copies,
server first (there is no sync script between them; a missing client edit still
type-checks and drifts silently — root INSIGHTS.md).

- **Extend `ConventionCandidate`** (the shape already exists, `knowledge.ts:163`):
  - add `category: string` — the model classifies each rule; shown/grouped in UI.
  - add `status: ConventionStatus` (`z.enum(['pending','accepted','rejected'])`) —
    the canonical lifecycle state. `accepted: boolean` stays and mirrors
    `status === 'accepted'` for back-compat.
  - `confidence` stays a `0..1` ratio; the UI renders `confidence * 100`.
- **New request DTOs** used by the routes below:
  - `UpdateConventionBody = { rule?, category?, evidence_path?, evidence_snippet? }`.
  - `CreateConventionSkillBody = { name, description, type: SkillType, body,
    enabled, convention_ids: string[] }`.
- **No new skill contract** — a bundled convention is an ordinary `Skill` with
  `type: 'convention'` and `source: 'extracted'` (both enum members already
  exist), and `evidence_files` set to the accepted candidates' distinct paths.
- **No feature-model contract change** — `FeatureModelId` already includes
  `'conventions'` (`platform.ts`, default `openai` / `gpt-5.4`, overridable per
  workspace in Settings).

## Data model

The `conventions` table already exists (`server/src/db/schema/knowledge.ts:31`,
shipped empty) with `id, workspaceId, repoId, rule, evidencePath, evidenceSnippet,
confidence, accepted`. It gains, via one additive migration
(`pnpm db:generate && pnpm db:migrate`):

- `category text`
- `status text` enum `['pending','accepted','rejected']`, `notNull default 'pending'`
- `createdAt` (the shared `now()` helper — the table currently has no timestamp)
- `extractionRunId uuid` (nullable) — groups the candidates of one scan so the UI
  can show "detected from N files · last scan …" and so a re-scan cleanly replaces
  the previous set.

`accepted` is kept and written in lock-step with `status` (status is canonical).

## API surface

New `server/src/modules/conventions/` plugin (routes → service → repository;
registered in `modules/index.ts`; Zod-validated params/body from `@devdigest/shared`):

- `POST /repos/:id/conventions/extract` — **rate-limited** (it makes an LLM call;
  same guard as `POST /pulls/:id/review`). Runs the extraction pipeline, replaces
  the repo's candidate set, returns the verified `ConventionCandidate[]` + the
  count of sample files used.
- `GET  /repos/:id/conventions` — list the repo's candidates.
- `POST /conventions/:id/accept` · `POST /conventions/:id/reject` — set `status`
  (mirrors the finding-action pattern, `reviews/routes.ts` / `findings.ts`).
- `PUT  /conventions/:id` — edit a candidate (`UpdateConventionBody`).
- `POST /repos/:id/conventions/skill` — bundle: verify the given `convention_ids`
  are `accepted`, derive `evidence_files` = distinct evidence paths, and create the
  skill (`source:'extracted'`) via the existing `SkillsService`.

## Extraction & evidence verification (the core behaviour)

1. **Sample selection — 100% code, no model.** Read config files directly from the
   clone (`.eslintrc*`, `tsconfig.json`, `.prettierrc*`, `package.json`) — the
   existing sampler deliberately *excludes* configs — plus the top-ranked source
   files from `repoIntel.getConventionSamples(repoId, 12)`
   (`repo-intel/service.ts:630`). If the repo isn't indexed / repo-intel is off,
   the sampler returns `[]`; surface a clear "index this repo first" state.
2. **One cheap model call.** Resolve the workspace's `conventions` feature model
   (`resolveFeatureModel(...)`), then `container.llm(provider).completeStructured`
   with schema `{ candidates: ConventionCandidate-without-id/status }`. The model
   returns `{ category, rule, evidence_path, evidence_snippet, confidence }[]`.
3. **Deterministic evidence gate.** For each candidate, confirm `evidence_path`
   resolves to a real file in the clone **and** `evidence_snippet` occurs in that
   file (whitespace-normalized). **Any candidate that fails is dropped** — this is
   what makes the "most findings are noise" problem tractable. (Mirrors the spirit
   of reviewer-core's grounding gate: no real citation → discarded.)
4. Persist survivors as `status:'pending'` under a fresh `extractionRunId`,
   replacing the previous scan.

## UX & flows

- **Route:** a global `/conventions` page in the **Skills Lab** nav group, reading
  the active repo from `useActiveRepo()` (consistent with `/skills` and `/agents`,
  which are also not path-scoped). `activeKeyFor` already maps `/conventions`;
  adding the nav item requires editing the vendored `client/src/vendor/ui/nav.ts`
  (a documented, deliberate exception to the vendor freeze).
- **List view:** header "Conventions in <repo> · detected from N sample files ·
  last scan …" + **Re-scan**; a "M of K accepted" bar; one **card** per candidate
  — rule as title, `evidence_path` over the snippet in a mono block, a confidence
  bar (`confidence * 100`), **Accepted / Reject** buttons, and an edit affordance.
- **Create skill from conventions modal:** clones the existing create-skill modal
  and adds the **Enabled toggle** + **live token count** from the skill editor's
  Config tab. Prefilled: `name = "<repo>-conventions"`, a description, and a body
  composed from the accepted candidates (a header + one `## <rule>` section each,
  citing its `file:line`). Everything is editable before save. **Create skill** →
  `POST /repos/:id/conventions/skill`; the skill lands in Skills Lab.
- All user-facing strings via `next-intl` (new `conventions` namespace);
  `ConventionCandidate` type imported from `@devdigest/shared`, never redeclared.

## Acceptance criteria

- Running **Re-scan** on an indexed repo produces candidates, and a candidate
  whose cited file/snippet does **not** exist in the repo never appears (verified
  by feeding the extractor a mock model that emits one real and one fabricated
  citation — only the real one survives).
- Accept / reject flips a candidate's `status` and it survives reload; a re-scan
  replaces the previous candidate set for that repo.
- **Create skill from conventions** creates one `type:'convention'`,
  `source:'extracted'` skill whose `evidence_files` are the accepted candidates'
  paths, with the edited name/description/body/enabled; it appears in Skills Lab.
- The created skill can be bound to an agent through the **existing** Agent editor
  and then flows into that agent's review prompt unchanged.
- Extraction makes exactly **one** model call per scan; sample selection and
  evidence verification make **zero**.
- A missing LLM key for the resolved provider surfaces as a clear 4xx on
  `extract`, not a 500 (keys are optional at boot, fail at call time).

## Open questions / deferred

- **Line-range evidence.** `evidence_path` may carry a `:start-end` suffix (the
  design shows `src/api/users.ts:23-31`). Verification matches the snippet against
  the whole file for tolerance; do we also assert it sits near the cited lines, or
  keep the looser match? (Proposed: looser match now.)
- **Cost/model default.** Default is `openai`/`gpt-5.4`; for cheap local runs a
  workspace can point the `conventions` feature model at
  `openrouter`/`deepseek/deepseek-v4-flash`. Should the registry default itself be
  the cheap model? (Deferred to the feature-model owner.)
- **Multi-skill / per-category bundling** and **scan-to-scan diffing** — deferred
  (see Scope out).
