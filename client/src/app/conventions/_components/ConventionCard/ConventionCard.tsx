/* ConventionCard — one detected convention candidate: rule title, the evidence
   `file:line` over its snippet, a confidence bar, and Accept / Reject actions. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, Button, IconBtn, PercentProgress } from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import { s } from "./styles";

function confidenceColor(confidence: number): string {
  if (confidence >= 0.85) return "var(--ok, #34d399)";
  if (confidence >= 0.7) return "var(--warn, #f59e0b)";
  return "var(--danger, #ef4444)";
}

export function ConventionCard({
  convention,
  onAccept,
  onReject,
  onEdit,
  busy = false,
}: {
  convention: ConventionCandidate;
  onAccept: () => void;
  onReject: () => void;
  onEdit: () => void;
  busy?: boolean;
}) {
  const t = useTranslations("conventions.card");
  const accepted = convention.status === "accepted";
  const rejected = convention.status === "rejected";

  return (
    <Card pad={false} style={s.card}>
      <div style={s.inner}>
        <div style={s.main}>
          <div style={s.ruleRow}>
            <h3 style={s.rule}>{convention.rule}</h3>
            <IconBtn icon="Edit" label={t("edit")} onClick={onEdit} />
          </div>
          <div style={s.evidence}>
            <span className="mono" style={s.path}>
              {convention.evidence_path}
            </span>
            <pre className="mono" style={s.snippet}>
              {convention.evidence_snippet}
            </pre>
          </div>
          <div style={s.confidence}>
            <PercentProgress
              value={convention.confidence * 100}
              label={t("confidence")}
              color={confidenceColor(convention.confidence)}
            />
          </div>
        </div>
        <div style={s.actions}>
          <Button
            kind={accepted ? "primary" : "secondary"}
            size="sm"
            icon="Check"
            onClick={onAccept}
            disabled={busy}
          >
            {accepted ? t("accepted") : t("accept")}
          </Button>
          <Button
            kind={rejected ? "danger" : "ghost"}
            size="sm"
            icon="X"
            onClick={onReject}
            disabled={busy}
            style={
              rejected
                ? { background: "var(--crit)", color: "#fff", borderColor: "var(--crit)" }
                : undefined
            }
          >
            {rejected ? t("rejected") : t("reject")}
          </Button>
        </div>
      </div>
    </Card>
  );
}
