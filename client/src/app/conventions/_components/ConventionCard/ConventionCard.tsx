/* ConventionCard — one detected convention candidate: rule title, the evidence
   `file:line` over its snippet, a confidence bar, and Accept / Reject actions. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Card, Button, IconBtn, PercentProgress } from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import { githubBlobUrl, type RepoRef } from "./helpers";
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
  repo = null,
}: {
  convention: ConventionCandidate;
  onAccept: () => void;
  onReject: () => void;
  onEdit: () => void;
  busy?: boolean;
  /** Active repo's GitHub coordinates, so the evidence path can link to the
      file on GitHub. When absent, the path renders as plain text. */
  repo?: RepoRef | null;
}) {
  const t = useTranslations("conventions.card");
  const accepted = convention.status === "accepted";
  const rejected = convention.status === "rejected";
  const evidenceUrl = githubBlobUrl(repo, convention.evidence_path);

  return (
    <Card pad={false} style={s.card}>
      <div style={s.inner}>
        <div style={s.main}>
          <div style={s.ruleRow}>
            <h3 style={s.rule}>{convention.rule}</h3>
            <IconBtn icon="Edit" label={t("edit")} onClick={onEdit} />
          </div>
          <div style={s.evidence}>
            {evidenceUrl ? (
              <a
                className="mono"
                style={s.pathLink}
                href={evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={t("openOnGitHub", { path: convention.evidence_path })}
              >
                {convention.evidence_path}
              </a>
            ) : (
              <span className="mono" style={s.path}>
                {convention.evidence_path}
              </span>
            )}
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
