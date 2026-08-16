/* Lightweight, dependency-free markdown source tokenizer for the read-only body
   preview. It is deliberately NOT a full markdown parser — it only recognizes
   two things the design highlights: ATX headings (`#`/`##`/`###` lines, colored
   accent) and inline `` `code` `` spans (rendered as a subtle mono chip). Pure
   and line-scoped so it is trivially unit-testable. */

export type MdToken =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string };

export interface MdLine {
  /** True for an ATX heading line (`#`…`###` followed by whitespace). */
  heading: boolean;
  /** The line broken into plain-text and inline-code tokens. */
  tokens: MdToken[];
}

const HEADING = /^#{1,3}(\s|$)/;
const INLINE_CODE = /`([^`]+)`/g;

/** Split a plain (non-heading) line into alternating text / inline-code tokens. */
function parseInline(line: string): MdToken[] {
  const tokens: MdToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_CODE.lastIndex = 0;
  while ((m = INLINE_CODE.exec(line)) !== null) {
    if (m.index > last) tokens.push({ kind: "text", text: line.slice(last, m.index) });
    tokens.push({ kind: "code", text: m[1]! });
    last = INLINE_CODE.lastIndex;
  }
  if (last < line.length) tokens.push({ kind: "text", text: line.slice(last) });
  // Preserve empty lines as a single empty text token so the row still renders.
  if (tokens.length === 0) tokens.push({ kind: "text", text: line });
  return tokens;
}

/**
 * Tokenize a single source line. Heading lines are returned whole (the caller
 * colors them accent); everything else is split on inline-code spans. Backticks
 * are dropped from `code` tokens — the chip styling delimits them instead.
 */
export function tokenizeMarkdownLine(line: string): MdLine {
  if (HEADING.test(line)) return { heading: true, tokens: [{ kind: "text", text: line }] };
  return { heading: false, tokens: parseInline(line) };
}
