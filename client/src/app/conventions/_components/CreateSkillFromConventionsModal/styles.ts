import type React from "react";

export const s: Record<string, React.CSSProperties> = {
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  footerNote: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "var(--text-muted)",
  },
  footerActions: { display: "flex", gap: 8 },
  // No flex `gap` here on purpose: every FormField already carries its own
  // marginBottom, so a column gap would ADD to it and double the rhythm. The
  // banner isn't a FormField, so it gets an explicit marginBottom to match.
  // `padding: 24` insets the body content so it lines up with the header title
  // (Modal's header pads 24px) and matches the design; the Modal children slot
  // has no padding of its own. Mirrors the skills CreateSkillModal body.
  body: { display: "flex", flexDirection: "column", padding: 24 },
  banner: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    padding: "10px 12px",
    borderRadius: 8,
    background: "var(--bg-hover)",
    border: "1px solid var(--border)",
    fontSize: 13,
    color: "var(--text-secondary)",
    marginBottom: 20,
  },
  bannerRepo: { color: "var(--accent)" },
  typeRow: { display: "flex", gap: 32, alignItems: "flex-start" },
  enabledRow: { display: "flex", alignItems: "center", gap: 10 },
  // Bordered code panel — mirrors the diff-viewer FileCard: a bordered container
  // with a filename header row and a borderless mono body.
  bodyPanel: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    overflow: "hidden",
    background: "var(--bg-elevated)",
  },
  bodyHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-surface)",
  },
  bodyHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  bodyHeaderRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  fileIcon: { color: "var(--text-muted)", flexShrink: 0 },
  filename: { fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" },
  tokens: { fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" },
  bodyTextarea: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    border: "none",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: 14,
    lineHeight: 1.55,
    padding: "12px 14px",
    resize: "vertical",
    outline: "none",
  },
  // Read-only source preview — a left line-number gutter (mirrors the diff-viewer
  // `lineNo`) plus lightly-highlighted markdown source per line.
  preview: {
    maxHeight: 320,
    overflowY: "auto",
    padding: "10px 0",
    fontSize: 14,
    lineHeight: 1.55,
  },
  previewRow: {
    display: "flex",
    alignItems: "flex-start",
  },
  previewLineNo: {
    width: 44,
    textAlign: "right",
    padding: "0 12px 0 0",
    color: "var(--text-muted)",
    userSelect: "none",
    flexShrink: 0,
  },
  previewLineText: {
    flex: 1,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "var(--text-primary)",
    paddingRight: 14,
    minHeight: "1.55em",
  },
  previewHeading: { color: "var(--accent)", fontWeight: 600 },
  previewCode: {
    background: "var(--bg-hover)",
    borderRadius: 4,
    padding: "0 4px",
    color: "var(--text-primary)",
  },
};
