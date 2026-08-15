import type { SkillType } from "@devdigest/shared";

/** Selectable skill types (labels are i18n'd under skills.listItem.type). */
export const TYPE_VALUES: readonly SkillType[] = ["rubric", "convention", "security", "custom"];

/** Debounce (ms) before re-counting body tokens as the user types. */
export const TOKEN_DEBOUNCE_MS = 400;
