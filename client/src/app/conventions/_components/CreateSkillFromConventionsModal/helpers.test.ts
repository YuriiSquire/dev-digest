import { describe, it, expect } from "vitest";
import type { ConventionCandidate } from "@devdigest/shared";
import { composeSkillBody, slugifyRule } from "./helpers";

const c = (over: Partial<ConventionCandidate>): ConventionCandidate => ({
  id: "x",
  category: "cat",
  rule: "A rule",
  evidence_path: "src/a.ts:1-2",
  evidence_snippet: "const x = 1;",
  confidence: 0.9,
  status: "accepted",
  accepted: true,
  ...over,
});

describe("composeSkillBody", () => {
  it("emits a header plus one section per accepted convention citing its evidence", () => {
    const body = composeSkillBody("payments-api", [
      c({ rule: "Always use async/await instead of .then() chains", evidence_path: "src/api/users.ts:23-31", evidence_snippet: "const user = await db.users.find(id);" }),
      c({ rule: "Redis access goes through the singleton", evidence_path: "src/lib/redis.ts:1-9", evidence_snippet: "export const redis = new Redis(x);" }),
    ]);
    expect(body).toContain("# payments-api-conventions");
    expect(body).toContain("Always use async/await instead of .then() chains");
    expect(body).toContain("Detected in `src/api/users.ts:23-31`");
    expect(body).toContain("export const redis = new Redis(x);");
    // One heading per convention.
    expect((body.match(/^## /gm) ?? []).length).toBe(2);
  });

  it("slugifyRule produces a short kebab heading", () => {
    expect(slugifyRule("Always use async/await instead of .then() chains")).toBe(
      "always-use-async-await-instead-of-then-chains",
    );
    expect(slugifyRule("")).toBe("rule");
  });
});
