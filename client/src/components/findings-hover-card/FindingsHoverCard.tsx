/* FindingsHoverCard — read-only preview of a run's findings, shown on
   hover over the severity-badge cluster in the Timeline. Reuses the same
   presentational primitives as FindingCard (SeverityBadge, CategoryTag,
   MonoLink, ConfidenceNum) but has no accept/dismiss actions of its own —
   the deep-dive happens in the accordion below via `onSelect`. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { FindingRow, sortFindings } from "./FindingRow";

export function FindingsHoverCard({
  findings,
  repoFullName,
  headSha,
  onSelect,
}: {
  findings: FindingRecord[];
  repoFullName?: string | null;
  headSha?: string | null;
  /** Jump to this run's full findings in the accordion below. */
  onSelect?: () => void;
}) {
  const t = useTranslations("prReview");
  const sorted = React.useMemo(() => sortFindings(findings), [findings]);

  return (
    <div
      role="tooltip"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        left: 0,
        width: 380,
        maxHeight: 420,
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
        {t("timeline.findingsHoverTitle", { count: sorted.length })}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {sorted.map((f, i) => (
          <FindingRow key={f.id} finding={f} repoFullName={repoFullName} headSha={headSha} first={i === 0} />
        ))}
      </div>

      {onSelect && (
        <button
          type="button"
          onClick={onSelect}
          style={{
            marginTop: 4,
            background: "none",
            border: "none",
            padding: 0,
            fontSize: 12,
            color: "var(--accent-text)",
            cursor: "pointer",
            textDecoration: "underline",
            textDecorationStyle: "dotted",
            textUnderlineOffset: 3,
          }}
        >
          {t("timeline.goToReview")}
        </button>
      )}
    </div>
  );
}
