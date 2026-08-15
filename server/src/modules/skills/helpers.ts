import type { Skill, SkillType } from '@devdigest/shared';
import type { SkillRow } from '../../db/rows.js';
import { ValidationError } from '../../platform/errors.js';

/**
 * Pure helpers for the skills module — DB row ⇄ DTO mapping, small text
 * utilities, and the SSRF host guard used by URL import. No network I/O (the
 * guard only inspects a URL string; it never resolves or fetches it).
 */

/** Map a persisted skill row to the public `Skill` DTO. */
export function toSkillDto(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
  };
}

/**
 * Derive a skill name from the first markdown heading (`# …`), falling back when
 * the body has none. Used by imports where the name is left blank.
 */
export function nameFromHeading(body: string, fallback = 'Untitled skill'): string {
  const heading = body
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /^#{1,6}\s+\S/.test(l));
  if (!heading) return fallback;
  return heading.replace(/^#{1,6}\s+/, '').trim() || fallback;
}

/**
 * True when a hostname points at a private, loopback, link-local, or
 * cloud-metadata address. Blocks the SSRF classes for URL import: localhost,
 * 127.0.0.0/8, 10/8, 172.16/12, 192.168/16, 169.254/16 (incl. 169.254.169.254),
 * 0.0.0.0, ::1, and fc00::/7 (plus fe80::/10 link-local). Pure string inspection
 * — DNS is not resolved here.
 */
export function isBlockedHost(hostname: string): boolean {
  let host = hostname.toLowerCase().trim();
  // Strip IPv6 brackets that URL.hostname keeps (e.g. "[::1]").
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);

  if (host === '' || host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '0.0.0.0' || host === '::' || host === '::1') return true;

  // IPv6 (contains a colon).
  if (host.includes(':')) {
    const first = host.split(':')[0] ?? '';
    // fc00::/7 (unique local) → fc../fd..; fe80::/10 (link-local) → fe8..feb.
    if (/^f[cd]/.test(first)) return true;
    if (/^fe[89ab]/.test(first)) return true;
    return false;
  }

  // IPv4 dotted quad.
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }

  return false;
}

/**
 * Guard a user-supplied URL before ANY network call. Rejects non-http(s) schemes
 * and private/loopback/link-local/metadata hosts, throwing a `ValidationError`
 * (→ 422) so the fetch never happens. Callers MUST invoke this before fetching.
 */
export function assertSafeUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ValidationError('Only http(s) URLs are allowed');
  }
  if (isBlockedHost(url.hostname)) {
    throw new ValidationError('Refusing to fetch from a private or loopback address');
  }
}
