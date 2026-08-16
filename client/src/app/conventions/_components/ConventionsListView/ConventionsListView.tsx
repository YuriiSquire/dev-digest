/* /conventions — the Conventions Extractor screen. Lists detected convention
   candidates for the active repo, drives Re-scan (extraction), per-candidate
   accept/reject, and the "Create skill from conventions" modal. Repo comes from
   useActiveRepo() (global route, like /skills and /agents). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import { AppShell } from "../../../../components/app-shell";
import { useActiveRepo } from "../../../../lib/repo-context";
import {
  useConventions,
  useExtractConventions,
  useAcceptConvention,
  useRejectConvention,
} from "../../../../lib/hooks/conventions";
import { ConventionCard } from "../ConventionCard";
import { CreateSkillFromConventionsModal } from "../CreateSkillFromConventionsModal";
import { EditConventionModal } from "../EditConventionModal";
import { s } from "./styles";

export function ConventionsListView() {
  const t = useTranslations("conventions");
  const { repoId, activeRepo } = useActiveRepo();
  const repoName = activeRepo?.name ?? t("page.repoFallback");

  const { data, isLoading, isError, refetch } = useConventions(repoId);
  const extract = useExtractConventions(repoId ?? "");
  const accept = useAcceptConvention(repoId ?? "");
  const reject = useRejectConvention(repoId ?? "");
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<ConventionCandidate | null>(null);

  const conventions = data ?? [];
  const accepted = conventions.filter((c) => c.status === "accepted");
  const sampleCount = extract.data?.sample_count ?? null;
  const busy = accept.isPending || reject.isPending;

  const subtitle =
    sampleCount != null
      ? `${t("page.detected", { count: sampleCount })} · ${t("page.lastScanJustNow")}`
      : t("page.neverScanned");

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }]}>
      {creating && repoId && (
        <CreateSkillFromConventionsModal
          repoId={repoId}
          repoName={repoName}
          accepted={accepted}
          onClose={() => setCreating(false)}
        />
      )}

      {editing && repoId && (
        <EditConventionModal
          repoId={repoId}
          convention={editing}
          onClose={() => setEditing(null)}
        />
      )}

      <div style={s.page}>
        <div style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.h1}>
              {t("page.headingPrefix")}
              <span style={s.repo}>{repoName}</span>
            </h1>
            <p style={s.subtitle}>{subtitle}</p>
          </div>
          <Button
            kind="secondary"
            size="sm"
            icon="RefreshCw"
            onClick={() => extract.mutate()}
            disabled={!repoId || extract.isPending}
          >
            {extract.isPending ? t("page.scanning") : t("page.rescan")}
          </Button>
        </div>

        {extract.isError && <p style={s.error}>{t("page.extractionFailed")}</p>}

        {conventions.length > 0 && (
          <div style={s.toolbar}>
            <span style={s.acceptedCount}>
              {t("page.acceptedCount", { accepted: accepted.length, total: conventions.length })}
            </span>
            <Button
              kind="primary"
              size="sm"
              icon="Sparkles"
              onClick={() => setCreating(true)}
              disabled={accepted.length === 0 || creating}
            >
              {t("page.createSkill")}
            </Button>
          </div>
        )}

        {!repoId && <EmptyState icon="ListChecks" title={t("page.noRepo")} />}

        {repoId && isLoading && (
          <div style={s.list}>
            <Skeleton height={160} />
            <Skeleton height={160} />
          </div>
        )}
        {repoId && isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
        {repoId && !isLoading && !isError && conventions.length === 0 && (
          <EmptyState
            icon="ListChecks"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={extract.isPending ? t("page.scanning") : t("page.empty.cta")}
            onCta={() => extract.mutate()}
          />
        )}
        {conventions.length > 0 && (
          <div style={s.list}>
            {conventions.map((c) => (
              <ConventionCard
                key={c.id}
                convention={c}
                busy={busy}
                onAccept={() => accept.mutate(c.id)}
                onReject={() => reject.mutate(c.id)}
                onEdit={() => setEditing(c)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
