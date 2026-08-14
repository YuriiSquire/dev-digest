/* FindingsByAgentCard — the PR-list findings hover. The list's FINDINGS column
   sums each agent's latest run (see PrMeta.critical_count docs), so the hover
   has to explain that sum: one section per agent (name + its severity chips +
   its findings), mirroring the per-run blocks in the PR-detail timeline
   (RunHistory's SeverityFindings). Reuses FindingRow so rows match the flat
   FindingsHoverCard. Purely presentational — the caller supplies the groups. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SeverityBadge, type Severity } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { FindingRow, sortFindings } from "./FindingRow";

const SEVERITIES = ["CRITICAL", "WARNING", "SUGGESTION"] as const;

export interface AgentFindingGroup {
  /** Null when the agent was deleted; used only as a React key fallback. */
  agentId: string | null;
  agentName: string;
  findings: FindingRecord[];
}

function severityCounts(findings: FindingRecord[]): Record<(typeof SEVERITIES)[number], number> {
  const counts = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const f of findings) {
    if (f.severity in counts) counts[f.severity as (typeof SEVERITIES)[number]] += 1;
  }
  return counts;
}

export function FindingsByAgentCard({
  groups,
  repoFullName,
  headSha,
}: {
  groups: AgentFindingGroup[];
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  const t = useTranslations("prReview");
  const total = groups.reduce((n, g) => n + g.findings.length, 0);

  return (
    <div
      role="tooltip"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        left: 0,
        width: 400,
        maxHeight: 440,
        overflowY: "auto",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: 10,
        boxShadow: "var(--shadow-modal)",
        padding: 14,
        zIndex: 50,
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 10,
        }}
      >
        <Icon.Info size={13} />
        {t("list.findingsByAgentTitle", { count: total, agents: groups.length })}
      </div>

      {groups.map((g, gi) => {
        const counts = severityCounts(g.findings);
        return (
          <div key={g.agentId ?? `${g.agentName}-${gi}`} style={{ marginTop: gi === 0 ? 0 : 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{g.agentName}</span>
              {SEVERITIES.map((sev) =>
                counts[sev] ? <SeverityBadge key={sev} severity={sev as Severity} count={counts[sev]} compact /> : null,
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {sortFindings(g.findings).map((f, i) => (
                <FindingRow key={f.id} finding={f} repoFullName={repoFullName} headSha={headSha} first={i === 0} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
