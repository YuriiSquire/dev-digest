import type { CommunitySkill } from '@devdigest/shared';

/** Constants for the skills module. */

/** Initial version recorded for a newly-created skill. */
export const INITIAL_SKILL_VERSION = 1;

/** Default description when a skill is created/imported without one. */
export const DEFAULT_SKILL_DESCRIPTION = '';

/** Default type for imported/manual skills that don't declare one. */
export const DEFAULT_SKILL_TYPE = 'custom' as const;

/**
 * A community skill fixture — the public `CommunitySkill` metadata plus the
 * `body` we copy in when a user imports it. `body` is internal (not part of the
 * shared `CommunitySkill` contract), so `listCommunity` strips it before it
 * leaves the service.
 */
export interface CommunitySkillFixture extends CommunitySkill {
  body: string;
}

/**
 * Static catalog of importable community skills. This is a curated fixture, not
 * a live registry — the Skills page renders it as the "Community" tab and
 * `importFromCommunity` copies the matching `body` into a new skill.
 */
export const COMMUNITY_SKILLS: CommunitySkillFixture[] = [
  {
    name: 'OWASP Top 10 Reviewer',
    repo: 'devdigest-community/owasp-top-10',
    stars: 1240,
    lang: 'any',
    desc: 'Flags the OWASP Top 10:2025 vulnerability classes in a diff.',
    body: '# OWASP Top 10 Reviewer\n\nReview the diff for the OWASP Top 10:2025 classes: broken access control, injection, insecure design, security misconfiguration, and secrets in source. Report each with a concrete remediation.',
  },
  {
    name: 'React Hooks Rules',
    repo: 'devdigest-community/react-hooks-rules',
    stars: 830,
    lang: 'typescript',
    desc: 'Enforces the Rules of Hooks and common React anti-patterns.',
    body: '# React Hooks Rules\n\nFlag hooks called conditionally or in loops, missing dependency arrays, and state derived in effects instead of during render.',
  },
  {
    name: 'Go Error Wrapping',
    repo: 'devdigest-community/go-error-wrapping',
    stars: 512,
    lang: 'go',
    desc: 'Checks that errors are wrapped with %w and context is preserved.',
    body: '# Go Error Wrapping\n\nFlag errors returned without context. Prefer fmt.Errorf("...: %w", err) so callers can errors.Is/As the wrapped cause.',
  },
  {
    name: 'SQL Injection Guard',
    repo: 'devdigest-community/sql-injection-guard',
    stars: 977,
    lang: 'any',
    desc: 'Detects string-concatenated SQL and demands parameterized queries.',
    body: '# SQL Injection Guard\n\nFlag any SQL assembled by string concatenation or interpolation of untrusted input. Require parameterized queries or a query builder.',
  },
];
