import type { Skill, SkillType } from "@devdigest/shared";

/** Editable slice of a skill's config form. */
export interface ConfigDraft {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled: boolean;
}

/** Derive the on-disk filename shown above the body editor (e.g. `pr-rubric.md`). */
export function skillFilename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "skill"}.md`;
}

/** True when the draft differs from the persisted skill (drives the "unsaved" flag). */
export function isDirty(draft: ConfigDraft, skill: Skill): boolean {
  return (
    draft.name !== skill.name ||
    draft.description !== skill.description ||
    draft.type !== skill.type ||
    draft.body !== skill.body ||
    draft.enabled !== skill.enabled
  );
}
