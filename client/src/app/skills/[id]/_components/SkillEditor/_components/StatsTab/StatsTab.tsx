/* Stats tab — KPI tiles (used-by / pull frequency / accept rate / findings 30d),
   the agents that link this skill, and a findings-by-category donut. Rates are
   ratios rendered as % or "—" when null. Source: useSkillStats. */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MetricCard, Donut, ErrorState, Skeleton, Icon } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useSkillStats } from "../../../../../../../lib/hooks/skills";
import { formatPct, toCategorySegments } from "./helpers";
import { s } from "./styles";

export function StatsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills.stats");
  const dash = useTranslations("skills.listItem")("dash");
  const { data: stats, isLoading, isError, refetch } = useSkillStats(skill.id);

  if (isLoading) return <Skeleton height={120} />;
  if (isError || !stats) return <ErrorState body={t("loadError")} onRetry={() => refetch()} />;

  const segments = toCategorySegments(stats.by_category);

  return (
    <div style={s.wrap}>
      <div style={s.tiles}>
        <MetricCard label={t("usedBy")} value={stats.used_by_agents} suffix={` ${t("usedBySuffix")}`} />
        <MetricCard label={t("pullFrequency")} value={formatPct(stats.pull_frequency, dash)} />
        <MetricCard label={t("acceptRate")} value={formatPct(stats.accept_rate, dash)} />
        <MetricCard label={t("findings30d")} value={stats.findings_30d} />
      </div>

      <div style={s.section}>
        <h3 style={s.sectionTitle}>{t("agentsUsing")}</h3>
        {stats.agents_using.length === 0 ? (
          <p style={s.empty}>{t("agentsEmpty")}</p>
        ) : (
          <div style={s.agentList}>
            {stats.agents_using.map((a) => (
              <Link key={a.agent_id} href={`/agents/${a.agent_id}?tab=config`} style={s.agentRow}>
                <Icon.Cpu size={14} style={{ color: "var(--accent)" }} />
                <span style={s.agentName}>{a.name}</span>
                <Icon.ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={s.section}>
        <h3 style={s.sectionTitle}>{t("findingsByCategory")}</h3>
        {segments.length === 0 ? (
          <p style={s.empty}>{t("categoryEmpty")}</p>
        ) : (
          <Donut segments={segments} valuePrefix="" />
        )}
      </div>
    </div>
  );
}
