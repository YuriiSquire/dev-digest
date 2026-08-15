import type { CSSProperties } from "react";

/** Co-located styles for the skill StatsTab. */
export const s = {
  wrap: { maxWidth: 820 } satisfies CSSProperties,
  tiles: { display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap" } satisfies CSSProperties,
  section: { marginBottom: 28 } satisfies CSSProperties,
  sectionTitle: { fontSize: 14, fontWeight: 700, marginBottom: 12 } satisfies CSSProperties,
  agentList: { display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  agentRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    fontSize: 13,
    color: "var(--text-primary)",
    textDecoration: "none",
  } satisfies CSSProperties,
  agentName: { flex: 1 } satisfies CSSProperties,
  empty: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
