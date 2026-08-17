import { describe, it, expect } from 'vitest';
import { verifyCandidates, stripLineSuffix } from './verify.js';

interface C {
  rule: string;
  evidence_path: string;
  evidence_snippet: string;
}

const files: Record<string, string> = {
  'src/api/users.ts':
    'const user = await db.users.find(id);\nconst posts = await db.posts.findMany({ userId });',
  'src/lib/redis.ts': 'export const redis = new Redis(config.redisUrl);',
};
const read = (p: string): string | null => files[p] ?? null;

describe('verifyCandidates (evidence gate)', () => {
  it('keeps a real citation, drops a fabricated file and a real file with an absent snippet', () => {
    const real: C = {
      rule: 'Always use async/await',
      evidence_path: 'src/api/users.ts:1-2',
      evidence_snippet: 'const user = await db.users.find(id);',
    };
    const fabricatedFile: C = {
      rule: 'Invented rule',
      evidence_path: 'src/does/not/exist.ts',
      evidence_snippet: 'whatever',
    };
    const absentSnippet: C = {
      rule: 'Snippet not in file',
      evidence_path: 'src/lib/redis.ts',
      evidence_snippet: 'export const mongo = new Mongo();',
    };

    const { kept, dropped } = verifyCandidates([real, fabricatedFile, absentSnippet], read);

    expect(kept).toEqual([real]);
    expect(dropped).toEqual([
      { candidate: fabricatedFile, reason: 'file_not_found' },
      { candidate: absentSnippet, reason: 'snippet_not_found' },
    ]);
  });

  it('matches snippets tolerant of whitespace differences', () => {
    const c: C = {
      rule: 'r',
      evidence_path: 'src/api/users.ts',
      evidence_snippet: 'const   user =\n   await db.users.find(id);',
    };
    expect(verifyCandidates([c], read).kept).toEqual([c]);
  });

  it('treats an empty file read as not-found', () => {
    const c: C = { rule: 'r', evidence_path: 'src/empty.ts', evidence_snippet: 'x' };
    expect(verifyCandidates([c], () => '').dropped[0]?.reason).toBe('file_not_found');
  });

  it('stripLineSuffix removes :line and :start-end', () => {
    expect(stripLineSuffix('src/a.ts:23-31')).toBe('src/a.ts');
    expect(stripLineSuffix('src/a.ts:5')).toBe('src/a.ts');
    expect(stripLineSuffix('src/a.ts')).toBe('src/a.ts');
  });
});
