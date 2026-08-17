import { randomUUID } from 'node:crypto';
import type { Container } from '../../platform/container.js';
import type { ConventionCandidate, ConventionStatus, Skill, SkillType } from '@devdigest/shared';
import type { RepoRef } from '@devdigest/shared';
import { ConventionsRepository, type UpdateConvention } from './repository.js';
import { ConventionExtraction, CONVENTION_EXTRACTION_SCHEMA_NAME } from './schema.js';
import { verifyCandidates, stripLineSuffix } from './verify.js';
import { buildExtractionMessages, toConventionDto, type SampleFile } from './helpers.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { SkillsService } from '../skills/service.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';

/**
 * Conventions Extractor service. `extract` is the core pipeline:
 *   1. sample files — CONFIG + top source files, read in CODE (no model)
 *   2. ONE structured LLM call → raw candidates
 *   3. deterministic evidence gate → drop hallucinated citations
 *   4. persist survivors as `pending`, replacing the prior scan
 * Accept/reject/edit mutate status/fields; `createSkill` bundles accepted
 * candidates into a `convention`/`extracted` skill via the existing SkillsService.
 */

// Well-known config paths — the rank sampler deliberately EXCLUDES these
// (JUNK_PATH_PATTERNS), yet they are the most convention-dense files, so we read
// them straight from the clone.
const CONFIG_PATHS = [
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  'eslint.config.js',
  'eslint.config.mjs',
  '.prettierrc',
  '.prettierrc.json',
  'prettier.config.js',
  'tsconfig.json',
  'package.json',
];
const SAMPLE_COUNT = 12;

export interface CreateConventionSkillInput {
  name: string;
  description?: string;
  type?: SkillType;
  body: string;
  enabled?: boolean;
  conventionIds: string[];
}

export class ConventionsService {
  private repo: ConventionsRepository;

  constructor(private container: Container) {
    this.repo = new ConventionsRepository(container.db);
  }

  async list(workspaceId: string, repoId: string): Promise<ConventionCandidate[]> {
    const rows = await this.repo.listByRepo(workspaceId, repoId);
    return rows.map(toConventionDto);
  }

  /** Read a clone file, returning null on any failure (missing/binary/etc.). */
  private async readClone(repoRef: RepoRef, path: string): Promise<string | null> {
    try {
      const content = await this.container.git.readFile(repoRef, path);
      return content === '' ? null : content;
    } catch {
      return null;
    }
  }

  async extract(
    workspaceId: string,
    repoId: string,
  ): Promise<{ candidates: ConventionCandidate[]; sampleCount: number }> {
    const ref = await this.repo.getRepoRef(workspaceId, repoId);
    if (!ref) throw new NotFoundError('Repo not found');
    const repoRef: RepoRef = { owner: ref.owner, name: ref.name };

    // 1. Sample selection — 100% code, no model.
    const samplePaths = await this.container.repoIntel
      .getConventionSamples(repoId, SAMPLE_COUNT)
      .catch(() => [] as string[]);
    const candidatePaths = [...new Set([...CONFIG_PATHS, ...samplePaths])];
    const files: SampleFile[] = [];
    for (const path of candidatePaths) {
      const content = await this.readClone(repoRef, path);
      if (content) files.push({ path, content });
    }
    if (files.length === 0) {
      throw new ValidationError(
        'No source files available to analyze — index the repo first, then re-scan.',
      );
    }

    // 2. One cheap structured model call.
    const { provider, model } = await resolveFeatureModel(this.container, workspaceId, 'conventions');
    const llm = await this.container.llm(provider);
    const result = await llm.completeStructured({
      model,
      schema: ConventionExtraction,
      schemaName: CONVENTION_EXTRACTION_SCHEMA_NAME,
      messages: buildExtractionMessages(ref.fullName, files),
      temperature: 0,
    });

    // 3. Deterministic evidence gate — read each CITED file (may differ from the
    // sample set) once, then verify purely.
    const citedPaths = [
      ...new Set(result.data.candidates.map((c) => stripLineSuffix(c.evidence_path))),
    ];
    const contentByPath = new Map<string, string>();
    for (const path of citedPaths) {
      const content = await this.readClone(repoRef, path);
      if (content) contentByPath.set(path, content);
    }
    const { kept } = verifyCandidates(
      result.data.candidates,
      (path) => contentByPath.get(stripLineSuffix(path)) ?? null,
    );

    // 4. Persist survivors, replacing the prior scan.
    const extractionRunId = randomUUID();
    await this.repo.deleteByRepo(workspaceId, repoId);
    const rows = await this.repo.insertMany(
      kept.map((c) => ({
        workspaceId,
        repoId,
        category: c.category,
        rule: c.rule,
        evidencePath: c.evidence_path,
        evidenceSnippet: c.evidence_snippet,
        confidence: c.confidence,
        extractionRunId,
      })),
    );
    return { candidates: rows.map(toConventionDto), sampleCount: files.length };
  }

  async setStatus(
    workspaceId: string,
    id: string,
    status: ConventionStatus,
  ): Promise<ConventionCandidate> {
    const row = await this.repo.setStatus(workspaceId, id, status);
    if (!row) throw new NotFoundError('Convention not found');
    return toConventionDto(row);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateConvention,
  ): Promise<ConventionCandidate> {
    const existing = await this.repo.getById(workspaceId, id);
    if (!existing) throw new NotFoundError('Convention not found');
    const row = await this.repo.update(workspaceId, id, patch);
    return toConventionDto(row!);
  }

  /**
   * Bundle accepted convention candidates into one `convention`/`extracted`
   * skill. `evidence_files` = the distinct cited paths of the referenced
   * candidates. Body/name/etc. come from the (edited) modal input.
   */
  async createSkill(
    workspaceId: string,
    repoId: string,
    input: CreateConventionSkillInput,
  ): Promise<Skill> {
    void repoId;
    const rows = await this.repo.getManyByIds(workspaceId, input.conventionIds);
    if (rows.length === 0) throw new NotFoundError('No matching conventions found');
    const evidenceFiles = [
      ...new Set(rows.map((r) => r.evidencePath).filter((p): p is string => !!p)),
    ];
    const skills = new SkillsService(this.container);
    return skills.create(workspaceId, {
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      type: input.type ?? 'convention',
      body: input.body,
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      evidence_files: evidenceFiles,
      source: 'extracted',
    });
  }
}
