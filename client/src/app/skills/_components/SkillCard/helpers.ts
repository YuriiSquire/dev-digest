import type { Skill, SkillType, SkillSource } from "@devdigest/shared";
import { TRUSTED_SOURCE, TYPE_COLOR } from "./constants";

/** Resolve the chip colour for a skill type (unknown → secondary token). */
export function typeColor(type: SkillType): string {
  return TYPE_COLOR[type] ?? "var(--text-secondary)";
}

/** A non-manual source that is still disabled has not been vetted yet. */
export function needsVetting(skill: Pick<Skill, "source" | "enabled">): boolean {
  return skill.source !== TRUSTED_SOURCE && !skill.enabled;
}

/** Format a [0,1] ratio as a whole-percent string, or "—" when null. */
export function formatPct(ratio: number | null | undefined, dash: string): string {
  if (ratio == null) return dash;
  return `${Math.round(ratio * 100)}%`;
}

/** i18n keys are `listItem.type.<type>` and `listItem.source.<source>`. */
export function typeKey(type: SkillType): string {
  return `type.${type}`;
}
export function sourceKey(source: SkillSource): string {
  return `source.${source}`;
}
