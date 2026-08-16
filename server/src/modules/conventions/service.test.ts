import { describe, it, expect, vi } from 'vitest';

// Stub the workspace model resolution so the unit test never touches the DB.
vi.mock('../settings/feature-models.js', () => ({
  resolveFeatureModel: async () => ({ provider: 'openai', model: 'gpt-test' }),
}));

import type { Container } from '../../platform/container.js';
import { MockLLMProvider, MockGitClient } from '../../adapters/mocks.js';
import { ConventionsService } from './service.js';
import { CONVENTION_EXTRACTION_SCHEMA_NAME } from './schema.js';
import type { ConventionRow } from '../../db/rows.js';
import type { InsertConvention } from './repository.js';

const REAL = {
  category: 'async',
  rule: 'Always use async/await instead of .then() chains',
  evidence_path: 'src/api/users.ts',
  evidence_snippet: 'const user = await db.users.find(id);',
  confidence: 0.91,
};
const FABRICATED = {
  category: 'invented',
  rule: 'This cites a file that does not exist',
  evidence_path: 'src/ghost/nowhere.ts',
  evidence_snippet: 'const nope = true;',
  confidence: 0.8,
};

function makeService() {
  const mockLlm = new MockLLMProvider('openai', {
    structuredBySchema: {
      [CONVENTION_EXTRACTION_SCHEMA_NAME]: { candidates: [REAL, FABRICATED] },
    },
  });
  const mockGit = new MockGitClient({
    files: {
      'src/api/users.ts':
        'const user = await db.users.find(id);\nconst posts = await db.posts.findMany({ userId });',
      'tsconfig.json': '{ "compilerOptions": { "strict": true } }',
    },
  });
  const inserted: InsertConvention[] = [];
  const fakeRepo = {
    getRepoRef: async () => ({ owner: 'acme', name: 'payments-api', fullName: 'acme/payments-api' }),
    deleteByRepo: async () => {},
    insertMany: async (values: InsertConvention[]): Promise<ConventionRow[]> => {
      inserted.push(...values);
      return values.map(
        (v, i) =>
          ({
            id: `conv-${i}`,
            workspaceId: v.workspaceId,
            repoId: v.repoId,
            category: v.category,
            rule: v.rule,
            evidencePath: v.evidencePath,
            evidenceSnippet: v.evidenceSnippet,
            confidence: v.confidence,
            status: 'pending',
            accepted: false,
            extractionRunId: v.extractionRunId,
            createdAt: new Date(),
          }) as ConventionRow,
      );
    },
  };
  const container = {
    db: {},
    git: mockGit,
    repoIntel: { getConventionSamples: async () => ['src/api/users.ts'] },
    llm: async () => mockLlm,
  } as unknown as Container;

  const service = new ConventionsService(container);
  (service as unknown as { repo: unknown }).repo = fakeRepo;
  return { service, mockLlm, inserted };
}

describe('ConventionsService.extract', () => {
  it('makes exactly one model call, drops the fabricated citation, persists survivors as pending', async () => {
    const { service, mockLlm, inserted } = makeService();

    const { candidates, sampleCount } = await service.extract('ws-1', 'repo-1');

    // Exactly one structured LLM call.
    expect(mockLlm.calls.filter((c) => c.method === 'completeStructured')).toHaveLength(1);
    // Only the real (verifiable) candidate survives.
    expect(candidates.map((c) => c.rule)).toEqual([REAL.rule]);
    expect(candidates[0]).toMatchObject({ status: 'pending', accepted: false, category: 'async' });
    // Persisted exactly the survivor.
    expect(inserted).toHaveLength(1);
    expect(inserted[0]!.evidencePath).toBe('src/api/users.ts');
    // Sample count reflects the code-read files (config + sample).
    expect(sampleCount).toBeGreaterThan(0);
  });
});
