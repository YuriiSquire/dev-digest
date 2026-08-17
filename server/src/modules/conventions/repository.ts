import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { ConventionStatus } from '@devdigest/shared';
import type { ConventionRow } from '../../db/rows.js';

export type { ConventionRow };

/**
 * Conventions data-access. Owns the `conventions` table (workspace-scoped). A
 * scan replaces the repo's prior candidate set via `deleteByRepo` + `insertMany`
 * under a fresh `extractionRunId`. `status` is canonical; `accepted` is written
 * in lock-step (`status === 'accepted'`).
 */

export interface InsertConvention {
  workspaceId: string;
  repoId: string;
  category: string | null;
  rule: string;
  evidencePath: string;
  evidenceSnippet: string;
  confidence: number;
  extractionRunId: string;
}

export interface UpdateConvention {
  category?: string;
  rule?: string;
  evidencePath?: string;
  evidenceSnippet?: string;
}

export class ConventionsRepository {
  constructor(private db: Db) {}

  /** The repo's owner/name (for the git clone reader), scoped to the workspace. */
  async getRepoRef(
    workspaceId: string,
    repoId: string,
  ): Promise<{ owner: string; name: string; fullName: string } | undefined> {
    const [row] = await this.db
      .select({ owner: t.repos.owner, name: t.repos.name, fullName: t.repos.fullName })
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return row;
  }

  async listByRepo(workspaceId: string, repoId: string): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)))
      // Deterministic, mutation-stable order. `confidence` sets the intended
      // visual order (best first) and never changes on accept/reject. But a scan
      // batch-inserts its candidates in ONE statement, so they all share the
      // same `created_at` (Postgres now() is transaction-start time), and
      // confidence itself frequently ties — leaving tied rows in unspecified
      // heap order that the accept/reject UPDATE shifts (the "list jumps" bug).
      // `id` (unique PK, never mutated) is the final tiebreaker that pins it.
      .orderBy(desc(t.conventions.confidence), asc(t.conventions.createdAt), asc(t.conventions.id));
  }

  async getById(workspaceId: string, id: string): Promise<ConventionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)));
    return row;
  }

  async getManyByIds(workspaceId: string, ids: string[]): Promise<ConventionRow[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), inArray(t.conventions.id, ids)));
  }

  /** Drop every candidate for a repo — a re-scan replaces the whole set. */
  async deleteByRepo(workspaceId: string, repoId: string): Promise<void> {
    await this.db
      .delete(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)));
  }

  async insertMany(values: InsertConvention[]): Promise<ConventionRow[]> {
    if (values.length === 0) return [];
    return this.db
      .insert(t.conventions)
      .values(
        values.map((v) => ({
          workspaceId: v.workspaceId,
          repoId: v.repoId,
          category: v.category,
          rule: v.rule,
          evidencePath: v.evidencePath,
          evidenceSnippet: v.evidenceSnippet,
          confidence: v.confidence,
          status: 'pending' as const,
          accepted: false,
          extractionRunId: v.extractionRunId,
        })),
      )
      .returning();
  }

  /** Set the lifecycle status (and mirror `accepted`). Workspace-scoped. */
  async setStatus(
    workspaceId: string,
    id: string,
    status: ConventionStatus,
  ): Promise<ConventionRow | undefined> {
    const [row] = await this.db
      .update(t.conventions)
      .set({ status, accepted: status === 'accepted' })
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row;
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateConvention,
  ): Promise<ConventionRow | undefined> {
    const set: Partial<typeof t.conventions.$inferInsert> = {};
    if (patch.category !== undefined) set.category = patch.category;
    if (patch.rule !== undefined) set.rule = patch.rule;
    if (patch.evidencePath !== undefined) set.evidencePath = patch.evidencePath;
    if (patch.evidenceSnippet !== undefined) set.evidenceSnippet = patch.evidenceSnippet;
    if (Object.keys(set).length === 0) return this.getById(workspaceId, id);
    const [row] = await this.db
      .update(t.conventions)
      .set(set)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row;
  }
}
