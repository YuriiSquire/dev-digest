import { describe, it, expect } from "vitest";
import { githubBlobUrl, type RepoRef } from "./helpers";

const REPO: RepoRef = { owner: "acme", name: "widgets", default_branch: "main" };

describe("githubBlobUrl", () => {
  it("builds a range anchor from `path:start-end`", () => {
    expect(githubBlobUrl(REPO, "src/api/users.ts:23-31")).toBe(
      "https://github.com/acme/widgets/blob/main/src/api/users.ts#L23-L31",
    );
  });

  it("builds a single-line anchor from `path:line`", () => {
    expect(githubBlobUrl(REPO, "src/api/users.ts:23")).toBe(
      "https://github.com/acme/widgets/blob/main/src/api/users.ts#L23",
    );
  });

  it("omits the anchor when there is no line spec", () => {
    expect(githubBlobUrl(REPO, "src/api/users.ts")).toBe(
      "https://github.com/acme/widgets/blob/main/src/api/users.ts",
    );
  });

  it("uses the repo's default branch", () => {
    expect(githubBlobUrl({ ...REPO, default_branch: "develop" }, "a/b.ts:5")).toBe(
      "https://github.com/acme/widgets/blob/develop/a/b.ts#L5",
    );
  });

  it("treats a trailing non-numeric colon segment as part of the path", () => {
    expect(githubBlobUrl(REPO, "src/a:b.ts")).toBe(
      "https://github.com/acme/widgets/blob/main/src/a:b.ts",
    );
  });

  it("returns null when the branch is missing", () => {
    expect(githubBlobUrl({ ...REPO, default_branch: "" }, "src/api/users.ts:23")).toBeNull();
  });

  it("returns null when the owner is missing", () => {
    expect(githubBlobUrl({ ...REPO, owner: "" }, "src/api/users.ts:23")).toBeNull();
  });

  it("returns null when the name is missing", () => {
    expect(githubBlobUrl({ ...REPO, name: "" }, "src/api/users.ts:23")).toBeNull();
  });

  it("returns null when the repo is absent", () => {
    expect(githubBlobUrl(null, "src/api/users.ts:23")).toBeNull();
    expect(githubBlobUrl(undefined, "src/api/users.ts:23")).toBeNull();
  });

  it("returns null when the path is empty or only a line spec", () => {
    expect(githubBlobUrl(REPO, "")).toBeNull();
    expect(githubBlobUrl(REPO, ":23")).toBeNull();
  });
});
