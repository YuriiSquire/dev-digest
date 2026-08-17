import type { SkillType } from "@devdigest/shared";

// Wide modal to match the design: the merged-from banner fits on one line and
// the fields/skill-body panel have room. 640 was too narrow (banner wrapped,
// content cramped).
export const MODAL_WIDTH = 960;
export const DEFAULT_TYPE: SkillType = "convention";
export const TYPE_VALUES: SkillType[] = ["rubric", "convention", "security", "custom"];
export const TOKEN_DEBOUNCE_MS = 400;
