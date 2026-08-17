import type React from "react";

export const s: Record<string, React.CSSProperties> = {
  page: { padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 1100 },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  headerText: { display: "flex", flexDirection: "column", gap: 4 },
  h1: { margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-primary)" },
  repo: { color: "var(--accent)" },
  subtitle: { margin: 0, fontSize: 13, color: "var(--text-secondary)" },
  error: { margin: 0, fontSize: 13, color: "var(--danger, #ef4444)" },
  toolbar: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  acceptedCount: { fontSize: 13, color: "var(--text-secondary)" },
  list: { display: "flex", flexDirection: "column", gap: 16 },
};
