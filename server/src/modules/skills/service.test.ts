import { describe, it, expect, vi } from 'vitest';
import { SkillsService } from './service.js';
import { ValidationError, NotFoundError } from '../../platform/errors.js';
import type { Container } from '../../platform/container.js';
import type { InsertSkill } from './repository.js';
import type { SkillRow } from '../../db/rows.js';

/**
 * Hermetic unit coverage for SkillsService — the decision logic (import defaults,
 * the SSRF short-circuit, community lookup, token delegation) with the data layer
 * and tokenizer stubbed. No DB, no network.
 */

/** A fake repository that echoes the InsertSkill it was handed as a SkillRow. */
function fakeRepo() {
  const inserted: InsertSkill[] = [];
  const repo = {
    inserted,
    async insert(values: InsertSkill): Promise<SkillRow> {
      inserted.push(values);
      return {
        id: 'new-id',
        workspaceId: values.workspaceId,
        name: values.name,
        description: values.description ?? '',
        type: values.type,
        source: values.source,
        body: values.body,
        enabled: values.enabled ?? true,
        version: 1,
        evidenceFiles: values.evidenceFiles ?? null,
        createdAt: new Date(),
      };
    },
  };
  return repo;
}

/** Build a service with a stubbed repo (and optional tokenizer). */
function makeService(tokenizer?: { count: (t: string) => number }) {
  const container = {
    db: {},
    tokenizer: tokenizer ?? { count: () => 0 },
  } as unknown as Container;
  const service = new SkillsService(container);
  const repo = fakeRepo();
  (service as unknown as { repo: unknown }).repo = repo;
  return { service, repo };
}

describe('importFromUrl SSRF guard', () => {
  it('rejects a loopback URL WITHOUT ever calling fetchBody', async () => {
    const { service } = makeService();
    const fetchSpy = vi.fn(async () => '# never');
    (service as unknown as { fetchBody: unknown }).fetchBody = fetchSpy;

    await expect(service.importFromUrl('w1', { url: 'http://localhost:3001/s.md' })).rejects.toThrow(
      ValidationError,
    );
    await expect(
      service.importFromUrl('w1', { url: 'http://169.254.169.254/latest' }),
    ).rejects.toThrow(ValidationError);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a non-http scheme without fetching', async () => {
    const { service } = makeService();
    const fetchSpy = vi.fn(async () => '# never');
    (service as unknown as { fetchBody: unknown }).fetchBody = fetchSpy;

    await expect(service.importFromUrl('w1', { url: 'file:///etc/passwd' })).rejects.toThrow(
      ValidationError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches and stores a disabled imported_url skill for a safe URL', async () => {
    const { service, repo } = makeService();
    (service as unknown as { fetchBody: (u: string) => Promise<string> }).fetchBody = async () =>
      '# Imported Skill\n\nbody';

    const skill = await service.importFromUrl('w1', {
      url: 'https://raw.githubusercontent.com/x/y/main/s.md',
    });

    expect(repo.inserted).toHaveLength(1);
    expect(repo.inserted[0]).toMatchObject({
      source: 'imported_url',
      enabled: false,
      name: 'Imported Skill',
      type: 'custom',
    });
    expect(skill.source).toBe('imported_url');
    expect(skill.enabled).toBe(false);
  });
});

describe('create source provenance', () => {
  it("defaults source to 'manual'", async () => {
    const { service, repo } = makeService();
    await service.create('w1', { name: 'Hand-authored', body: 'x' });
    expect(repo.inserted[0]).toMatchObject({ source: 'manual' });
  });

  it("honors an explicit source (e.g. 'extracted' for conventions-promotion)", async () => {
    const { service, repo } = makeService();
    await service.create('w1', {
      name: 'From conventions',
      type: 'convention',
      body: 'x',
      source: 'extracted',
      evidence_files: ['src/a.ts'],
    });
    expect(repo.inserted[0]).toMatchObject({
      source: 'extracted',
      type: 'convention',
      evidenceFiles: ['src/a.ts'],
    });
  });
});

describe('importFromText defaults', () => {
  it('derives the name from the heading, defaults type=custom, source=extracted, disabled', async () => {
    const { service, repo } = makeService();
    const skill = await service.importFromText('w1', { body: '# From Heading\n\nrules' });

    expect(repo.inserted[0]).toMatchObject({
      name: 'From Heading',
      type: 'custom',
      source: 'extracted',
      enabled: false,
    });
    expect(skill.name).toBe('From Heading');
  });

  it('honors an explicit name and type', async () => {
    const { service, repo } = makeService();
    await service.importFromText('w1', { name: '  Explicit  ', body: 'x', type: 'security' });
    expect(repo.inserted[0]).toMatchObject({ name: 'Explicit', type: 'security' });
  });

  it('falls back to the heading when name is blank whitespace', async () => {
    const { service, repo } = makeService();
    await service.importFromText('w1', { name: '   ', body: '# Heading Wins\n' });
    expect(repo.inserted[0]!.name).toBe('Heading Wins');
  });
});

describe('listCommunity', () => {
  it('returns the whole catalog with no filters and strips the internal body', () => {
    const { service } = makeService();
    const all = service.listCommunity();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0]).not.toHaveProperty('body');
    expect(all[0]).toHaveProperty('repo');
  });

  it('filters by free text (case-insensitive) across name/desc/repo', () => {
    const { service } = makeService();
    expect(service.listCommunity('owasp').map((s) => s.name)).toContain('OWASP Top 10 Reviewer');
    expect(service.listCommunity('SQL').length).toBeGreaterThan(0);
  });

  it('filters by language', () => {
    const { service } = makeService();
    const go = service.listCommunity(undefined, 'go');
    expect(go.length).toBeGreaterThan(0);
    expect(go.every((s) => s.lang === 'go')).toBe(true);
  });
});

describe('importFromCommunity', () => {
  it('copies the fixture body as a disabled community skill', async () => {
    const { service, repo } = makeService();
    const skill = await service.importFromCommunity('w1', 'OWASP Top 10 Reviewer');
    expect(repo.inserted[0]).toMatchObject({
      name: 'OWASP Top 10 Reviewer',
      source: 'community',
      enabled: false,
    });
    expect(repo.inserted[0]!.body.length).toBeGreaterThan(0);
    expect(skill.source).toBe('community');
  });

  it('is case-insensitive on the name', async () => {
    const { service, repo } = makeService();
    await service.importFromCommunity('w1', 'owasp top 10 reviewer');
    expect(repo.inserted[0]!.name).toBe('OWASP Top 10 Reviewer');
  });

  it('404s when the name is not in the catalog', async () => {
    const { service } = makeService();
    await expect(service.importFromCommunity('w1', 'no such skill')).rejects.toThrow(NotFoundError);
  });
});

describe('countTokens', () => {
  it('delegates to the injected tokenizer', () => {
    const count = vi.fn((t: string) => t.length);
    const { service } = makeService({ count });
    expect(service.countTokens('hello')).toBe(5);
    expect(count).toHaveBeenCalledWith('hello');
  });
});
