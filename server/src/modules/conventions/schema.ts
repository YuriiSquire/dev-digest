import { z } from 'zod';

/**
 * The LLM structured-output contract for convention extraction. Kept module-local
 * (not in `@devdigest/shared`) because it is the model's RAW, UNVERIFIED output —
 * clients never see it. It becomes a `ConventionCandidate` only after the
 * deterministic evidence gate + persistence. `schemaName` names the tool the
 * provider is forced into; the e2e MockLLM fixture is keyed on it.
 */
export const CONVENTION_EXTRACTION_SCHEMA_NAME = 'ConventionExtraction';

export const ConventionExtractionItem = z.object({
  category: z.string(),
  rule: z.string(),
  evidence_path: z.string(),
  evidence_snippet: z.string(),
  confidence: z.number().min(0).max(1),
});
export type ConventionExtractionItem = z.infer<typeof ConventionExtractionItem>;

export const ConventionExtraction = z.object({
  candidates: z.array(ConventionExtractionItem),
});
export type ConventionExtraction = z.infer<typeof ConventionExtraction>;
