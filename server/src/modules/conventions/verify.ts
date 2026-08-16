/**
 * Deterministic evidence gate — the heart of the Conventions Extractor. The LLM
 * proposes convention candidates with a cited `evidence_path` + `evidence_snippet`;
 * a model will happily invent both. This pure function proves each citation
 * against the REAL file contents (no model, no I/O — `readFile` is injected) and
 * DROPS any candidate whose file is unreadable or whose snippet isn't actually
 * present. Mirrors the spirit of reviewer-core's grounding gate.
 */

export type DropReason = 'file_not_found' | 'snippet_not_found';

export interface VerifyResult<T> {
  kept: T[];
  dropped: { candidate: T; reason: DropReason }[];
}

/** Strip a trailing `:line` or `:start-end` suffix so `src/a.ts:23-31` reads `src/a.ts`. */
export function stripLineSuffix(path: string): string {
  return path.replace(/:\d+(-\d+)?$/, '');
}

/** Collapse runs of whitespace to a single space and trim — tolerant snippet match. */
function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Keep a candidate iff its cited file is readable AND its snippet occurs in that
 * file (whitespace-normalized substring). `readFile` returns the file's contents,
 * or `null`/empty when the path doesn't resolve.
 */
export function verifyCandidates<
  T extends { evidence_path: string; evidence_snippet: string },
>(candidates: T[], readFile: (path: string) => string | null): VerifyResult<T> {
  const kept: T[] = [];
  const dropped: { candidate: T; reason: DropReason }[] = [];

  for (const candidate of candidates) {
    const content = readFile(stripLineSuffix(candidate.evidence_path));
    if (content == null || content === '') {
      dropped.push({ candidate, reason: 'file_not_found' });
      continue;
    }
    if (!normalize(content).includes(normalize(candidate.evidence_snippet))) {
      dropped.push({ candidate, reason: 'snippet_not_found' });
      continue;
    }
    kept.push(candidate);
  }

  return { kept, dropped };
}
