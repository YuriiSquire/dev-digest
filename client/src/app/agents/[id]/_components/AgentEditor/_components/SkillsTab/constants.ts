import type { SkillType } from "@devdigest/shared";

/** Badge tint per skill type (falls back to the muted secondary color). */
export const TYPE_COLOR: Record<SkillType, string> = {
  rubric: "var(--accent)",
  convention: "var(--text-secondary)",
  security: "var(--danger, #e5484d)",
  custom: "var(--text-muted)",
};
