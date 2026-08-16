import type { ConventionCandidate } from '@devdigest/shared';
import type { ConventionRow } from '../../db/rows.js';

/** Map a persisted convention row to the `ConventionCandidate` DTO. */
export function toConventionDto(row: ConventionRow): ConventionCandidate {
  return {
    id: row.id,
    category: row.category ?? '',
    rule: row.rule,
    evidence_path: row.evidencePath ?? '',
    evidence_snippet: row.evidenceSnippet ?? '',
    confidence: row.confidence ?? 0,
    status: row.status,
    accepted: row.accepted,
  };
}

/** A file sampled for the extraction prompt. */
export interface SampleFile {
  path: string;
  content: string;
}

/**
 * Build the system+user messages for the extraction call. We hand the model the
 * config + top source files and ask for house conventions with a cited
 * `evidence_path` + verbatim `evidence_snippet` — the snippet is what the
 * deterministic gate later checks against the real file.
 */
export function buildExtractionMessages(fullName: string, files: SampleFile[]) {
  const system =
    'You extract CODE-STYLE CONVENTIONS ("house rules") that a repository consistently follows. ' +
    'For each convention return: a short category, a one-line rule, the repo-relative evidence_path of ONE file that demonstrates it, ' +
    'a VERBATIM evidence_snippet copied from that file (a few lines, exactly as written), and a confidence in [0,1]. ' +
    'Only report conventions you can point to in the provided files. Do not invent files or snippets.';
  const body = files
    .map((f) => `FILE: ${f.path}\n\`\`\`\n${f.content.slice(0, 4000)}\n\`\`\``)
    .join('\n\n');
  const user = `Repository: ${fullName}\n\nAnalyze these files and list the conventions:\n\n${body}`;
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];
}
