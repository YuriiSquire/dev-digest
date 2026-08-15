import type { CSSProperties } from "react";

/** Co-located styles for SkillsTab. */
export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  count: { fontSize: 13, color: "var(--text-secondary)" } satisfies CSSProperties,
  hint: { fontSize: 13, color: "var(--text-muted)", marginBottom: 18 } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 6 } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  rowDragging: { opacity: 0.5 } satisfies CSSProperties,
  handle: {
    display: "grid",
    placeItems: "center",
    color: "var(--text-muted)",
    cursor: "grab",
    flexShrink: 0,
  } satisfies CSSProperties,
  name: { flex: 1, fontSize: 14, color: "var(--text-primary)", minWidth: 0 } satisfies CSSProperties,
  empty: { fontSize: 13, color: "var(--text-muted)", padding: "16px 0" } satisfies CSSProperties,
} as const;
