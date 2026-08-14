/* FindingRow — one finding line, shared by FindingsHoverCard (a single run's
   flat list, used in the timeline) and FindingsByAgentCard (grouped by agent,
   used in the PR-list findings hover). Keeping the row in one place stops the
   two cards from drifting on how a finding renders. */
"use client";

import React from "react";
import { SeverityBadge, CategoryTag, ConfidenceNum, MonoLink, type Severity, type Category } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { githubBlobUrl } from "@/lib/github-urls";

const SEV_RANK: Record<string, number> = { CRITICAL: 3, WARNING: 2, SUGGESTION: 1 };

/** Severity-desc, then confidence-desc — the order both cards present findings in. */
export function sortFindings(findings: FindingRecord[]): FindingRecord[] {
  return [...findings].sort(
    (a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0) || b.confidence - a.confidence,
  );
}

function lineLabel(f: Pick<FindingRecord, "start_line" | "end_line">): string {
  return f.start_line === f.end_line ? `${f.start_line}` : `${f.start_line}-${f.end_line}`;
}

export function FindingRow({
  finding: f,
  repoFullName,
  headSha,
  first,
}: {
  finding: FindingRecord;
  repoFullName?: string | null;
  headSha?: string | null;
  /** Drop the dashed top separator on the first row of a group. */
  first?: boolean;
}) {
  const fileHref =
    repoFullName && headSha ? githubBlobUrl(repoFullName, headSha, f.file, f.start_line, f.end_line) : undefined;
  return (
    <div style={{ padding: "10px 0", borderTop: first ? "none" : "1px dashed var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <SeverityBadge severity={f.severity as Severity} compact />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {f.title}
        </span>
        <CategoryTag category={f.category as Category} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <MonoLink href={fileHref}>
          {f.file}:{lineLabel(f)}
        </MonoLink>
        <ConfidenceNum value={f.confidence} />
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {f.rationale}
      </div>
    </div>
  );
}
