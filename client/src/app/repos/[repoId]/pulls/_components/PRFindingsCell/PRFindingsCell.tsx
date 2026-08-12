/* PRFindingsCell — the FINDINGS column in the PR list. The counts are the SUM
   across every agent's latest run (see PrMeta.critical_count), rendered as one
   compact SeverityBadge per non-zero aggregated severity. Each badge is a
   BUTTON: clicking a severity opens a FindingsByAgentCard showing ONLY that
   severity's findings, grouped by agent (each agent's latest review). Clicking
   the active severity again (or Escape / an outside click) closes it. Reviews
   are lazy-loaded on first open (usePrReviews is only mounted while a popup is
   open), so the list payload stays light. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SeverityBadge, type Severity } from "@devdigest/ui";
import type { PrMeta } from "@/lib/types";
import type { ReviewRecord } from "@devdigest/shared";
import { usePrReviews } from "@/lib/hooks/reviews";
import { FindingsByAgentCard, type AgentFindingGroup } from "@/components/findings-hover-card";

const SEVERITIES = ["CRITICAL", "WARNING", "SUGGESTION"] as const;

/** Epoch ms for sorting; unparseable / missing timestamps sort last. */
function tsOf(s: string | null | undefined): number {
  if (!s) return 0;
  const n = Date.parse(s);
  return Number.isNaN(n) ? 0 : n;
}

/** Group a PR's reviews into one entry per agent — that agent's LATEST review,
    keeping only agents that reported findings. Mirrors the server list rollup,
    which sums each agent's latest run. Sorted most-findings-first. */
function groupByAgentLatest(reviews: ReviewRecord[]): AgentFindingGroup[] {
  const latestByAgent = new Map<string, ReviewRecord>();
  for (const r of reviews) {
    if (r.kind !== "review") continue;
    // Fall back to the review id when the agent was deleted (agent_id null) so
    // those don't collapse into one bucket.
    const key = r.agent_id ?? r.id;
    const prev = latestByAgent.get(key);
    if (!prev || tsOf(r.created_at) > tsOf(prev.created_at)) latestByAgent.set(key, r);
  }
  return [...latestByAgent.values()]
    .filter((r) => r.findings.length > 0)
    .map((r) => ({ agentId: r.agent_id, agentName: r.agent_name ?? "Agent", findings: r.findings }))
    .sort((a, b) => b.findings.length - a.findings.length);
}

/**
 * Mounted only while a severity popup is open — mounting the hook here is what
 * makes the reviews fetch lazy (fires on first open). Groups the PR's reviews by
 * agent, then narrows each group to the clicked `severity`, dropping agents left
 * with none.
 */
function FindingsDropdown({
  prId,
  severity,
  repoFullName,
  headSha,
}: {
  prId: string;
  severity: Severity;
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  const t = useTranslations("prReview");
  const { data: reviews, isLoading } = usePrReviews(prId);

  const groups = React.useMemo(
    () =>
      groupByAgentLatest(reviews ?? [])
        .map((g) => ({ ...g, findings: g.findings.filter((f) => f.severity === severity) }))
        .filter((g) => g.findings.length > 0),
    [reviews, severity],
  );

  if (isLoading || groups.length === 0) {
    return (
      <div
        role="tooltip"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          left: 0,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
          borderRadius: 10,
          boxShadow: "var(--shadow-modal)",
          padding: "10px 14px",
          zIndex: 50,
          fontSize: 12,
          color: "var(--text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {isLoading ? t("list.findingsLoading") : t("list.noFindings")}
      </div>
    );
  }

  return <FindingsByAgentCard groups={groups} repoFullName={repoFullName} headSha={headSha} />;
}

export function PRFindingsCell({
  pr,
  repoFullName,
}: {
  pr: PrMeta;
  repoFullName?: string | null;
}) {
  const t = useTranslations("prReview");
  const [activeSeverity, setActiveSeverity] = React.useState<Severity | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const counts: Record<(typeof SEVERITIES)[number], number | null | undefined> = {
    CRITICAL: pr.critical_count,
    WARNING: pr.warning_count,
    SUGGESTION: pr.suggestion_count,
  };
  const total = SEVERITIES.reduce((sum, sev) => sum + (counts[sev] ?? 0), 0);
  const hasFindings = total > 0;
  // Chips are only interactive when there is something to preview AND we have a
  // PR id to fetch the reviews for.
  const canOpen = hasFindings && !!pr.id;

  // While a popup is open, close it on Escape or an outside click.
  React.useEffect(() => {
    if (!activeSeverity) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveSeverity(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveSeverity(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeSeverity]);

  // Never reviewed (all counts null/0): muted em-dash, no affordance.
  if (!hasFindings) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }

  const toggle = (sev: Severity) => setActiveSeverity((cur) => (cur === sev ? null : sev));

  return (
    <div ref={containerRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
      {SEVERITIES.map((sev) => {
        const n = counts[sev];
        if (typeof n !== "number" || n <= 0) return null;
        const isActive = activeSeverity === sev;
        return (
          <button
            key={sev}
            type="button"
            aria-pressed={isActive}
            aria-label={t("list.findingsBySeverity", { severity: sev })}
            onClick={() => canOpen && toggle(sev)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: isActive ? "var(--accent-bg)" : "transparent",
              border: `1px solid ${isActive ? "var(--accent)" : "transparent"}`,
              borderRadius: 6,
              padding: "1px 3px",
              cursor: canOpen ? "pointer" : "default",
            }}
          >
            <SeverityBadge severity={sev as Severity} count={n} compact />
          </button>
        );
      })}
      {canOpen && activeSeverity && (
        <FindingsDropdown
          prId={pr.id!}
          severity={activeSeverity}
          repoFullName={repoFullName}
          headSha={pr.head_sha}
        />
      )}
    </div>
  );
}
