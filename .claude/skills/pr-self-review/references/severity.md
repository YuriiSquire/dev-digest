# Severity rubric & gate

Every finding a review subagent returns carries one severity. The gate is computed
from severities alone, so the levels must be applied consistently.

## Levels

- **critical** — the change is wrong in a way that must not ship: a correctness
  bug, data loss, a security vulnerability (leaked secret, auth bypass, injection),
  a broken `@devdigest/shared` contract, a destructive or irreversible migration
  (drops a column/table, non-nullable add without default), or a layer-direction
  violation that breaks the build or a core invariant (e.g. a `service.ts` running
  raw SQL, `reviewer-core/` reaching for I/O). → **BLOCK**.
- **major** — likely-wrong behavior, missing input validation, a performance
  regression, or a test gap on new logic. Reported; does **not** block.
- **minor** — small correctness/style issues, naming, dead code. Reported; does
  not block.
- **nit** — cosmetic preference. Reported; does not block.

When unsure between `critical` and `major`, ask: *would a reviewer refuse to
approve the PR over this alone?* If yes → `critical`. If it's "please fix but I'd
still approve" → `major`.

## Gate

```
verdict = "BLOCK" if findings.some(f => f.severity === "critical") else "PASS"
```

- **BLOCK** — do not open the PR; the skill refuses `gh pr create` and lists the
  criticals to resolve.
- **PASS** — the diff is clear to open (major/minor/nit findings are surfaced for
  the author but do not gate).

## Finding shape

Each subagent returns a JSON array of:

```json
{
  "file": "server/src/modules/pulls/repository.ts",
  "line": 42,
  "severity": "critical",
  "category": "onion-architecture",
  "summary": "Raw SQL in service layer — repository ring bypassed",
  "suggestion": "Move the query into repository.ts and inject the result"
}
```

`category` is the skill that produced the finding, so the report can attribute
each line to its lens.
