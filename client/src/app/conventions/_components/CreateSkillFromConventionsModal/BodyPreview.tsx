/* Read-only, line-numbered source preview for the skill body. Renders the mono
   markdown source with a left line-number gutter and lightweight highlighting
   (accent headings + inline-code chips) via `tokenizeMarkdownLine`. The `body`
   state upstream stays the single source of truth — this only reads it. */
"use client";

import React from "react";
import { tokenizeMarkdownLine } from "./highlightMarkdown";
import { s } from "./styles";

export function BodyPreview({ body }: { body: string }) {
  // Drop a single trailing newline so a body that ends in "\n" doesn't render a
  // stray blank numbered line at the bottom.
  const src = body.endsWith("\n") ? body.slice(0, -1) : body;
  const lines = src.split("\n");

  return (
    <div className="mono" style={s.preview}>
      {lines.map((line, i) => {
        const { heading, tokens } = tokenizeMarkdownLine(line);
        return (
          <div key={i} style={s.previewRow}>
            <span className="tnum" style={s.previewLineNo}>
              {i + 1}
            </span>
            <span
              style={heading ? { ...s.previewLineText, ...s.previewHeading } : s.previewLineText}
            >
              {tokens.map((tok, j) =>
                tok.kind === "code" ? (
                  <span key={j} style={s.previewCode}>
                    {tok.text}
                  </span>
                ) : (
                  <React.Fragment key={j}>{tok.text}</React.Fragment>
                ),
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
