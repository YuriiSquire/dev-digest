import type { ContainerOverrides } from './container.js';
import { MockLLMProvider, MockGitClient } from '../adapters/mocks.js';
import { CONVENTION_EXTRACTION_SCHEMA_NAME } from '../modules/conventions/schema.js';

/**
 * TEST-ONLY deterministic fixtures for the hermetic e2e stack. Wired into the
 * BOOTED server ONLY when `E2E_FIXTURES=1` (see `buildApp`), so a real browser can
 * drive the Conventions Extractor end-to-end without an LLM key or a real clone.
 * NEVER resolved on a normal boot — the guard in buildApp is the only caller.
 *
 * The mock model returns the three conventions from the design mockup; the mock
 * clone exposes exactly the files they cite, so the deterministic evidence gate
 * keeps all three (nothing to hallucinate against).
 */
const FIXTURE_FILES: Record<string, string> = {
  'tsconfig.json': '{ "compilerOptions": { "strict": true } }',
  'src/api/users.ts':
    'const user = await db.users.find(id);\nconst posts = await db.posts.findMany({ userId });',
  'src/api/public/index.ts': 'function handler(): Result<Item[], ApiError> {\n  return ok(items);\n}',
  'src/lib/redis.ts': 'export const redis = new Redis(config.redisUrl);',
};

const EXTRACTION_FIXTURE = {
  candidates: [
    {
      category: 'async',
      rule: 'Always use async/await instead of .then() chains',
      evidence_path: 'src/api/users.ts:23-31',
      evidence_snippet: 'const user = await db.users.find(id);\nconst posts = await db.posts.findMany({ userId });',
      confidence: 0.91,
    },
    {
      category: 'api',
      rule: 'All public route handlers return typed Result<T, ApiError>',
      evidence_path: 'src/api/public/index.ts:14-20',
      evidence_snippet: 'function handler(): Result<Item[], ApiError> {\n  return ok(items);\n}',
      confidence: 0.78,
    },
    {
      category: 'infra',
      rule: 'Redis access goes through src/lib/redis.ts singleton',
      evidence_path: 'src/lib/redis.ts:1-9',
      evidence_snippet: 'export const redis = new Redis(config.redisUrl);',
      confidence: 0.85,
    },
  ],
};

export function e2eFixtureOverrides(): ContainerOverrides {
  // Bind the mock under EVERY provider key so the fixture is used no matter which
  // provider the `conventions` feature-model default resolves to (it is currently
  // openrouter, but must not couple to that).
  const llm = new MockLLMProvider('openai', {
    structuredBySchema: { [CONVENTION_EXTRACTION_SCHEMA_NAME]: EXTRACTION_FIXTURE },
  });
  return {
    git: new MockGitClient({ files: FIXTURE_FILES }),
    llm: { openai: llm, anthropic: llm, openrouter: llm },
  };
}
