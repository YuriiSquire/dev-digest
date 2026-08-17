/* Pure helpers for ConventionCard. `githubBlobUrl` turns a convention's
   `evidence_path` ("src/api/users.ts:23-31") into a GitHub blob URL with the
   right line anchor, or null when it can't (missing repo coords / bad path). */
import type { Repo } from "@devdigest/shared";

/** The subset of a Repo needed to build a GitHub blob URL. */
export type RepoRef = Pick<Repo, "owner" | "name" | "default_branch">;

/** Split an evidence path at its LAST colon into the file path and a `#L…`
    anchor. Only a trailing `<n>` or `<n>-<m>` counts as a line spec — anything
    else (e.g. a Windows drive or a colon in a name) is kept as part of the path. */
function splitEvidencePath(evidencePath: string): { filePath: string; lineHash: string } {
  const idx = evidencePath.lastIndexOf(":");
  if (idx === -1) return { filePath: evidencePath, lineHash: "" };

  const spec = evidencePath.slice(idx + 1);
  const m = spec.match(/^(\d+)(?:-(\d+))?$/);
  if (!m) return { filePath: evidencePath, lineHash: "" };

  const [, start, end] = m;
  return {
    filePath: evidencePath.slice(0, idx),
    lineHash: end ? `#L${start}-L${end}` : `#L${start}`,
  };
}

/**
 * Build `https://github.com/<owner>/<name>/blob/<branch>/<filePath>#L<start>[-L<end>]`
 * from a repo and a convention's `evidence_path`. Returns null when the repo
 * coordinates are missing or the path is empty, so the UI can fall back to
 * plain text.
 */
export function githubBlobUrl(
  repo: RepoRef | null | undefined,
  evidencePath: string | null | undefined,
): string | null {
  if (!repo || !evidencePath) return null;

  const { owner, name, default_branch } = repo;
  if (!owner || !name || !default_branch) return null;

  const { filePath, lineHash } = splitEvidencePath(evidencePath);
  if (!filePath) return null;

  return `https://github.com/${owner}/${name}/blob/${default_branch}/${filePath}${lineHash}`;
}
