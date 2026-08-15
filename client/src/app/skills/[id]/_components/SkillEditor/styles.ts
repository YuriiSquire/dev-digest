import type { CSSProperties } from "react";

/** Co-located styles for the SkillEditor shell. */
export const s = {
  wrap: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 } satisfies CSSProperties,
  tabsBar: { marginTop: 14, display: "flex", alignItems: "stretch", borderBottom: "1px solid var(--border)" } satisfies CSSProperties,
  disabledTabs: { display: "flex", alignItems: "center", gap: 2 } satisfies CSSProperties,
  disabledTab: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text-muted)",
    opacity: 0.5,
    cursor: "not-allowed",
  } satisfies CSSProperties,
  body: { flex: 1, overflow: "auto", padding: 28 } satisfies CSSProperties,
} as const;
