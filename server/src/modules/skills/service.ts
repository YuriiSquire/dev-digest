import type { Container } from '../../platform/container.js';
import type { CommunitySkill, Skill, SkillSource, SkillStats, SkillType } from '@devdigest/shared';
import { SkillsRepository } from './repository.js';
import { toSkillDto, nameFromHeading, assertSafeUrl } from './helpers.js';
import { COMMUNITY_SKILLS, DEFAULT_SKILL_TYPE } from './constants.js';
import { ExternalServiceError, NotFoundError } from '../../platform/errors.js';

/**
 * A1 — skills service. Business logic for the Skills page + editor: CRUD, the
 * three import flows (paste-text / URL / community), the body token count, and
 * the run-level usage stats.
 *
 * A Skill = name + type + body (+ source provenance) + enabled. Only `body` is
 * versioned (repository). Imports land disabled so a human enables them after
 * review.
 */

// Re-exported for consumers/tests.
export { toSkillDto } from './helpers.js';

export interface CreateSkillInput {
  name: string;
  description?: string;
  type?: SkillType;
  body: string;
  enabled?: boolean;
  evidence_files?: string[] | null;
  /** Provenance. Defaults to 'manual'; conventions-promotion passes 'extracted'. */
  source?: SkillSource;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

export interface ImportTextInput {
  name?: string;
  body: string;
  type?: SkillType;
}

export class SkillsService {
  private repo: SkillsRepository;

  constructor(private container: Container) {
    this.repo = new SkillsRepository(container.db);
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId);
    return rows.map(toSkillDto);
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    return row ? toSkillDto(row) : undefined;
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  /** Create a skill. Source defaults to 'manual' (hand-authored); callers such as
   *  conventions-promotion pass 'extracted' for provenance. */
  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      type: input.type ?? DEFAULT_SKILL_TYPE,
      source: input.source ?? 'manual',
      body: input.body,
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.evidence_files !== undefined ? { evidenceFiles: input.evidence_files } : {}),
    });
    return toSkillDto(row);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkillInput,
  ): Promise<Skill | undefined> {
    const row = await this.repo.update(workspaceId, id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    });
    return row ? toSkillDto(row) : undefined;
  }

  /**
   * Import a skill from pasted text. Source 'extracted', lands disabled. The name
   * falls back to the body's first markdown heading when left blank; type
   * defaults to 'custom'.
   */
  async importFromText(workspaceId: string, input: ImportTextInput): Promise<Skill> {
    const name = input.name?.trim() ? input.name.trim() : nameFromHeading(input.body);
    const row = await this.repo.insert({
      workspaceId,
      name,
      type: input.type ?? DEFAULT_SKILL_TYPE,
      source: 'extracted',
      body: input.body,
      enabled: false,
    });
    return toSkillDto(row);
  }

  /**
   * Import a skill from a URL. The SSRF guard runs FIRST — an unsafe URL throws
   * before `fetchBody` is ever called, so no request leaves the process. Source
   * 'imported_url', lands disabled.
   */
  async importFromUrl(workspaceId: string, input: { url: string }): Promise<Skill> {
    assertSafeUrl(input.url); // throws (422) before any network call
    const body = await this.fetchBody(input.url);
    const row = await this.repo.insert({
      workspaceId,
      name: nameFromHeading(body),
      type: DEFAULT_SKILL_TYPE,
      source: 'imported_url',
      body,
      enabled: false,
    });
    return toSkillDto(row);
  }

  /**
   * Fetch a URL's body. Isolated (and overridable in tests) so the import flow
   * can be exercised without real network I/O. NEVER call this without
   * `assertSafeUrl` first.
   */
  private async fetchBody(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new ExternalServiceError(`Failed to fetch skill from ${url} (${res.status})`);
    }
    return res.text();
  }

  /** Search the static community catalog by free text (name/desc/repo) and lang. */
  listCommunity(q?: string, lang?: string): CommunitySkill[] {
    const needle = q?.trim().toLowerCase();
    const wantLang = lang?.trim().toLowerCase();
    return COMMUNITY_SKILLS.filter((s) => {
      const matchesQ =
        !needle ||
        s.name.toLowerCase().includes(needle) ||
        s.desc.toLowerCase().includes(needle) ||
        s.repo.toLowerCase().includes(needle);
      const matchesLang = !wantLang || s.lang.toLowerCase() === wantLang;
      return matchesQ && matchesLang;
    }).map(({ body: _body, ...meta }) => meta);
  }

  /**
   * Import a community skill by name — copies its curated body into a new skill.
   * Source 'community', lands disabled. 404s when the name isn't in the catalog.
   */
  async importFromCommunity(workspaceId: string, name: string): Promise<Skill> {
    const fixture = COMMUNITY_SKILLS.find(
      (s) => s.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (!fixture) throw new NotFoundError('Community skill not found');
    const row = await this.repo.insert({
      workspaceId,
      name: fixture.name,
      description: fixture.desc,
      type: DEFAULT_SKILL_TYPE,
      source: 'community',
      body: fixture.body,
      enabled: false,
    });
    return toSkillDto(row);
  }

  /** Live token count for a skill body (drives the editor's budget meter). */
  countTokens(text: string): number {
    return this.container.tokenizer.count(text);
  }

  /**
   * Run-level usage stats for a skill. Returns undefined when the skill isn't in
   * this workspace (route → 404) so stats can't be read across tenants.
   */
  async stats(workspaceId: string, skillId: string): Promise<SkillStats | undefined> {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) return undefined;
    return this.repo.stats(workspaceId, skillId);
  }
}
