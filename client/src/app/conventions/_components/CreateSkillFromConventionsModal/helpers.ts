import type { ConventionCandidate } from "@devdigest/shared";

/** Derive the on-disk filename shown in the body panel header (e.g. `pr-rubric.md`).
 * Mirrors the skill ConfigTab's `skillFilename` so both editors read the same. */
export function skillFilename(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "skill"}.md`;
}

/** A short kebab-case heading slug from a rule sentence. */
export function slugifyRule(rule: string): string {
  return (
    rule
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .split("-")
      .slice(0, 8)
      .join("-") || "rule"
  );
}

/**
 * Compose the default skill body from the accepted convention candidates — a
 * header plus one `## <rule-slug>` section per convention, each stating the rule
 * and citing its evidence `file:line` + snippet. Mirrors the design mockup; fully
 * editable in the modal before save.
 */
export function composeSkillBody(repoName: string, accepted: ConventionCandidate[]): string {
  const header =
    `# ${repoName}-conventions\n\n` +
    `House conventions for \`${repoName}\`. Flag changes that violate any rule below and cite the offending \`file:line\`.`;
  const sections = accepted.map((c) => {
    const evidence = c.evidence_path
      ? `\nDetected in \`${c.evidence_path}\`:\n\n\`\`\`\n${c.evidence_snippet}\n\`\`\``
      : "";
    return `## ${slugifyRule(c.rule)}\n${c.rule}${evidence}`;
  });
  return [header, ...sections].join("\n\n") + "\n";
}
