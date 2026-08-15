import { describe, it, expect } from 'vitest';
import { toSkillDto, nameFromHeading, isBlockedHost, assertSafeUrl } from './helpers.js';
import { ValidationError } from '../../platform/errors.js';
import type { SkillRow } from '../../db/rows.js';

/**
 * Hermetic unit coverage for the skills helpers: row→DTO mapping, name-from-
 * heading fallback, and the SSRF host guard (the security-critical bit — it must
 * classify private/loopback/metadata hosts as blocked and reject non-http(s)).
 */

const baseRow: SkillRow = {
  id: 'a1b2',
  workspaceId: 'w1',
  name: 'Rubric',
  description: 'A rubric',
  type: 'rubric',
  source: 'manual',
  body: '# Rubric\n\nDo the thing.',
  enabled: true,
  version: 3,
  evidenceFiles: ['src/a.ts'],
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

describe('toSkillDto', () => {
  it('maps every column to its DTO field', () => {
    expect(toSkillDto(baseRow)).toEqual({
      id: 'a1b2',
      name: 'Rubric',
      description: 'A rubric',
      type: 'rubric',
      source: 'manual',
      body: '# Rubric\n\nDo the thing.',
      enabled: true,
      version: 3,
      evidence_files: ['src/a.ts'],
    });
  });

  it('normalizes a missing evidence_files to null', () => {
    expect(toSkillDto({ ...baseRow, evidenceFiles: null }).evidence_files).toBeNull();
  });
});

describe('nameFromHeading', () => {
  it('uses the first markdown heading', () => {
    expect(nameFromHeading('# Security Rubric\n\nbody')).toBe('Security Rubric');
    expect(nameFromHeading('intro\n### Nested\nmore')).toBe('Nested');
  });

  it('falls back when there is no heading', () => {
    expect(nameFromHeading('just prose, no heading')).toBe('Untitled skill');
    expect(nameFromHeading('plain', 'Fallback')).toBe('Fallback');
  });
});

describe('isBlockedHost', () => {
  it('blocks loopback / private / link-local / metadata / unspecified hosts', () => {
    for (const host of [
      'localhost',
      'app.localhost',
      '127.0.0.1',
      '127.9.9.9',
      '10.0.0.5',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '169.254.0.1',
      '169.254.169.254', // cloud metadata
      '0.0.0.0',
      '::1',
      '[::1]',
      'fc00::1',
      'fd12:3456::1',
      'fe80::1',
    ]) {
      expect(isBlockedHost(host), host).toBe(true);
    }
  });

  it('allows public hosts', () => {
    for (const host of ['example.com', 'raw.githubusercontent.com', '8.8.8.8', '172.32.0.1']) {
      expect(isBlockedHost(host), host).toBe(false);
    }
  });
});

describe('assertSafeUrl', () => {
  it('rejects a non-http(s) scheme', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow(ValidationError);
    expect(() => assertSafeUrl('ftp://example.com/x')).toThrow(ValidationError);
  });

  it('rejects a malformed URL', () => {
    expect(() => assertSafeUrl('not a url')).toThrow(ValidationError);
  });

  it('rejects private / loopback hosts', () => {
    expect(() => assertSafeUrl('http://localhost:3001/skill.md')).toThrow(ValidationError);
    expect(() => assertSafeUrl('http://169.254.169.254/latest/meta-data')).toThrow(ValidationError);
  });

  it('allows a public https URL', () => {
    expect(() => assertSafeUrl('https://raw.githubusercontent.com/x/y/main/skill.md')).not.toThrow();
  });
});
