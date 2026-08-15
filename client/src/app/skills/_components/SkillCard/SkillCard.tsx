/* SkillCard — type + source badges, an enabled toggle, a "needs vetting" flag
   for untrusted sources, and a usage footer (agents · pull · accept) from
   useSkillStats. Mirrors AgentCard. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useSkillStats } from "../../../../lib/hooks/skills";
import { TYPE_ICON } from "./constants";
import { formatPct, needsVetting, sourceKey, typeColor, typeKey } from "./helpers";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  onClick,
  onToggle,
}: {
  skill: Skill;
  active?: boolean;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const t = useTranslations("skills");
  const li = useTranslations("skills.listItem");
  const color = typeColor(skill.type);
  const TypeIcon = Icon[TYPE_ICON[skill.type]];
  const { data: stats } = useSkillStats(skill.id);
  const dash = li("dash");
  const vetting = needsVetting(skill);

  return (
    <div onClick={onClick} style={s.card(!!active, skill.enabled)}>
      <div style={s.headerRow}>
        <div style={s.iconBox(color)}>{TypeIcon && <TypeIcon size={15} />}</div>
        <span style={s.name}>{skill.name}</span>
        {onToggle && (
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </div>
        )}
      </div>

      <div style={s.description}>{skill.description}</div>

      <div style={s.metaRow}>
        <Badge color={color} icon={TYPE_ICON[skill.type]}>
          {li(typeKey(skill.type))}
        </Badge>
        <Badge color="var(--text-secondary)">{li(sourceKey(skill.source))}</Badge>
        {vetting && (
          <span title={li("vettingTitle")}>
            <Badge color="var(--warn)" icon="AlertTriangle">
              {li("needsVetting")}
            </Badge>
          </span>
        )}
      </div>

      <div style={s.footer}>
        {t("listItem.footer", {
          agents: stats?.used_by_agents ?? dash,
          pull: formatPct(stats?.pull_frequency, dash),
          accept: formatPct(stats?.accept_rate, dash),
        })}
      </div>
    </div>
  );
}
