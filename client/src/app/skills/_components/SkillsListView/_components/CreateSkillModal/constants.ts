import type { SkillType } from "@devdigest/shared";

/** Create-modal width (mirrors CreateAgentModal). */
export const MODAL_WIDTH = 560;

/** Default skill type for a hand-authored skill. */
export const DEFAULT_TYPE: SkillType = "rubric";

/** Selectable skill types (labels are i18n'd under skills.listItem.type). */
export const TYPE_VALUES: readonly SkillType[] = ["rubric", "convention", "security", "custom"];
