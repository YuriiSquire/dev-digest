import type { SkillType, SkillSource } from "@devdigest/shared";
import type { IconName } from "@devdigest/ui";

/** Card grid template (responsive auto-fill). Mirrors the Agents list grid. */
export const CARD_GRID_COLS = "repeat(auto-fill, minmax(280px, 1fr))";

/** Skill type → chip colour (falls back to --text-secondary). */
export const TYPE_COLOR: Record<SkillType, string> = {
  rubric: "#3b82f6",
  convention: "#10b981",
  security: "#ef4444",
  custom: "#8b5cf6",
};

/** Skill type → leading icon. */
export const TYPE_ICON: Record<SkillType, IconName> = {
  rubric: "FileText",
  convention: "Layers",
  security: "Shield",
  custom: "Sparkles",
};

/** Non-manual sources are untrusted until vetted + enabled. */
export const TRUSTED_SOURCE: SkillSource = "manual";
