import type React from "react";

export const s: Record<string, React.CSSProperties> = {
  card: { borderRadius: 12, overflow: "hidden" },
  inner: { display: "flex", gap: 16, padding: 20, alignItems: "flex-start" },
  main: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 },
  ruleRow: { display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "space-between" },
  rule: { margin: 0, fontSize: 15, fontWeight: 600, fontStyle: "italic", color: "var(--text-primary)" },
  evidence: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-surface, var(--bg-hover))",
    overflow: "hidden",
  },
  path: {
    display: "block",
    padding: "8px 12px",
    fontSize: 12,
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border)",
  },
  snippet: {
    margin: 0,
    padding: "12px",
    fontSize: 12.5,
    lineHeight: 1.5,
    color: "var(--text-primary)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowX: "auto",
  },
  confidence: { maxWidth: 320 },
  actions: { display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, width: 140 },
};
