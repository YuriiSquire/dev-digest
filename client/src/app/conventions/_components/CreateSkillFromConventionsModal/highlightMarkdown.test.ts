import { describe, it, expect } from "vitest";
import { tokenizeMarkdownLine } from "./highlightMarkdown";

describe("tokenizeMarkdownLine", () => {
  it("flags `#`/`##`/`###` lines as headings, returned whole", () => {
    for (const line of ["# Title", "## async-await", "### deep"]) {
      const { heading, tokens } = tokenizeMarkdownLine(line);
      expect(heading).toBe(true);
      expect(tokens).toEqual([{ kind: "text", text: line }]);
    }
  });

  it("does not treat 4+ hashes or a hash without whitespace as a heading", () => {
    expect(tokenizeMarkdownLine("#### too deep").heading).toBe(false);
    expect(tokenizeMarkdownLine("#nospace").heading).toBe(false);
  });

  it("splits inline `code` spans into chip tokens, stripping the backticks", () => {
    const { heading, tokens } = tokenizeMarkdownLine("Detected in `src/a.ts:1-2` here");
    expect(heading).toBe(false);
    expect(tokens).toEqual([
      { kind: "text", text: "Detected in " },
      { kind: "code", text: "src/a.ts:1-2" },
      { kind: "text", text: " here" },
    ]);
  });

  it("returns a single plain text token for an ordinary line", () => {
    expect(tokenizeMarkdownLine("just prose").tokens).toEqual([{ kind: "text", text: "just prose" }]);
  });

  it("keeps an empty line as one empty text token", () => {
    expect(tokenizeMarkdownLine("").tokens).toEqual([{ kind: "text", text: "" }]);
  });
});
