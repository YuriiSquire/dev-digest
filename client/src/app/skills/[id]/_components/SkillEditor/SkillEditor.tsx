/* SkillEditor — tabbed pane for a single skill: Config, Preview, Stats.
   Evals + Versions are shown disabled (later lessons). Mirrors AgentEditor. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Tabs, Icon } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ConfigTab } from "./_components/ConfigTab";
import { PreviewTab } from "./_components/PreviewTab";
import { StatsTab } from "./_components/StatsTab";
import { DISABLED_TABS, ENABLED_TABS } from "./constants";
import { s } from "./styles";

export function SkillEditor({ skill, tab, onTab }: { skill: Skill; tab: string; onTab: (t: string) => void }) {
  const t = useTranslations("skills.detail.tabs");
  const tabs = ENABLED_TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));

  return (
    <div style={s.wrap}>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
        <div style={s.disabledTabs}>
          {DISABLED_TABS.map((tb) => {
            const I = Icon[tb.icon];
            return (
              <span key={tb.key} style={s.disabledTab} aria-disabled title={t(tb.labelKey)}>
                {I && <I size={14} />}
                {t(tb.labelKey)}
              </span>
            );
          })}
        </div>
      </div>
      <div style={s.body}>
        {tab === "config" && <ConfigTab skill={skill} />}
        {tab === "preview" && <PreviewTab skill={skill} />}
        {tab === "stats" && <StatsTab skill={skill} />}
      </div>
    </div>
  );
}
