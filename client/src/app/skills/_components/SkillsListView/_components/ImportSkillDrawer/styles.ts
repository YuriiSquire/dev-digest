import type { CSSProperties } from "react";

/** Co-located styles for ImportSkillDrawer. */
export const s = {
  tabsBar: { marginBottom: 20 } satisfies CSSProperties,
  notice: {
    display: "flex",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 7,
    background: "var(--warn-bg)",
    color: "var(--warn)",
    fontSize: 12.5,
    lineHeight: 1.45,
    marginBottom: 18,
  } satisfies CSSProperties,
  actions: { display: "flex", justifyContent: "flex-end", marginTop: 6 } satisfies CSSProperties,
  communityList: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  communityRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  communityMeta: { flex: 1, minWidth: 0 } satisfies CSSProperties,
  communityName: { fontSize: 13, fontWeight: 600 } satisfies CSSProperties,
  communityDesc: {
    fontSize: 12,
    color: "var(--text-muted)",
    marginTop: 2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  communityStars: { fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 } satisfies CSSProperties,
  searchBar: { marginBottom: 14 } satisfies CSSProperties,
} as const;
