/* PRFindingsCell — the FINDINGS column in the PR list. The counts are the SUM
   across every agent's latest run (see PrMeta.critical_count), so this renders
   one compact SeverityBadge per non-zero aggregated severity; hovering opens a
   FindingsByAgentCard that breaks those findings down by agent (each agent's
   latest review). The reviews are lazy-loaded on first hover (usePrReviews is
   only mounted while the dropdown is open), so the list payload stays light.

   Hover-open behavior mirrors SeverityFindings in RunHistory.tsx (150ms delay,
   mouse/focus + Escape). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SeverityBadge, type Severity } from "@devdigest/ui";
import type { PrMeta } from "@/lib/types";
import type { ReviewRecord } from "@devdigest/shared";
import { usePrReviews } from "@/lib/hooks/reviews";
import { FindingsByAgentCard, type AgentFindingGroup } from "@/components/findings-hover-card";

/** Hover open/close delay (ms) — matches the timeline chips in RunHistory. */
const HOVER_DELAY_MS = 150;

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
 * Mounted only while the dropdown is open — mounting the hook here is what makes
 * the reviews fetch lazy (fires on first hover). Groups the PR's reviews by
 * agent (each agent's latest) and previews them in the by-agent card.
 */
function FindingsDropdown({
  prId,
  repoFullName,
  headSha,
}: {
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  const t = useTranslations("prReview");
  const { data: reviews, isLoading } = usePrReviews(prId);

  const groups = React.useMemo(() => groupByAgentLatest(reviews ?? []), [reviews]);

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
        {t("list.findingsLoading")}
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
  const [open, setOpen] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const counts: Record<(typeof SEVERITIES)[number], number | null | undefined> = {
    CRITICAL: pr.critical_count,
    WARNING: pr.warning_count,
    SUGGESTION: pr.suggestion_count,
  };
  const total = SEVERITIES.reduce((sum, sev) => sum + (counts[sev] ?? 0), 0);
  const hasFindings = total > 0;
  // Hover is only meaningful when there is something to preview AND we have a PR
  // id to fetch the reviews for.
  const hoverEnabled = hasFindings && !!pr.id;

  const show = () => {
    if (!hoverEnabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), HOVER_DELAY_MS);
  };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  };
  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // Never reviewed (all counts null/0): muted em-dash, no hover affordance.
  if (!hasFindings) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }

  return (
    <div
      style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}
      {...(hoverEnabled
        ? {
            tabIndex: 0,
            role: "button",
            "aria-expanded": open,
            "aria-label": t("timeline.findingsHoverTitle", { count: total }),
            onMouseEnter: show,
            onMouseLeave: hide,
            onFocus: show,
            onBlur: hide,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Escape") hide();
            },
          }
        : {})}
    >
      {SEVERITIES.map((sev) => {
        const n = counts[sev];
        return typeof n === "number" && n > 0 ? (
          <SeverityBadge key={sev} severity={sev as Severity} count={n} compact />
        ) : null;
      })}
      {hoverEnabled && open && (
        <FindingsDropdown prId={pr.id!} repoFullName={repoFullName} headSha={pr.head_sha} />
      )}
    </div>
  );
}
