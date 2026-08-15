import { and, asc, count, countDistinct, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import type { SkillType, SkillSource, SkillStats } from '@devdigest/shared';
import { DEFAULT_SKILL_DESCRIPTION, INITIAL_SKILL_VERSION } from './constants.js';

/**
 * A1 — skills data-access. Owns `skills` and `skill_versions` (the agent side of
 * `agent_skills` is owned by A2's AgentsRepository). Workspace-scoped throughout.
 *
 * Versioning: a skill's `body` is the only versioned field. Insert records v1;
 * a body change on update bumps `version` and snapshots the new body into
 * `skill_versions` (name/description/type/enabled edits do NOT bump). Each
 * `skill_versions` row holds the body AS OF that version.
 */

import type { SkillRow, SkillVersionRow } from '../../db/rows.js';
export type { SkillRow, SkillVersionRow };

export interface InsertSkill {
  workspaceId: string;
  name: string;
  description?: string;
  type: SkillType;
  source: SkillSource;
  body: string;
  enabled?: boolean;
  evidenceFiles?: string[] | null;
}

export interface UpdateSkill {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

/** Window (ms) for the "findings in the last 30 days" stat. */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class SkillsRepository {
  constructor(private db: Db) {}

  async list(workspaceId: string): Promise<SkillRow[]> {
    return this.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId))
      .orderBy(asc(t.skills.createdAt));
  }

  async getById(workspaceId: string, id: string): Promise<SkillRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row;
  }

  /** Delete a skill (scoped to workspace). Versions + agent/run links cascade.
   *  Returns false if no such skill existed in the workspace. */
  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  /** Insert a skill AND record version 1 in skill_versions (body snapshot). */
  async insert(values: InsertSkill): Promise<SkillRow> {
    const [row] = await this.db
      .insert(t.skills)
      .values({
        workspaceId: values.workspaceId,
        name: values.name,
        description: values.description ?? DEFAULT_SKILL_DESCRIPTION,
        type: values.type,
        source: values.source,
        body: values.body,
        enabled: values.enabled ?? true,
        version: INITIAL_SKILL_VERSION,
        evidenceFiles: values.evidenceFiles ?? null,
      })
      .returning();
    await this.snapshotBody(row!.id, INITIAL_SKILL_VERSION, row!.body);
    return row!;
  }

  /**
   * Update a skill. ONLY a body change bumps the version and snapshots the new
   * body into skill_versions — name/description/type/enabled edits leave the
   * version untouched. Returns undefined when the skill isn't in this workspace.
   */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkill,
  ): Promise<SkillRow | undefined> {
    const existing = await this.getById(workspaceId, id);
    if (!existing) return undefined;

    const bodyChanged = patch.body !== undefined && patch.body !== existing.body;
    const nextVersion = bodyChanged ? existing.version + 1 : existing.version;

    const [row] = await this.db
      .update(t.skills)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(bodyChanged ? { version: nextVersion } : {}),
      })
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning();

    if (bodyChanged && row) await this.snapshotBody(row.id, nextVersion, row.body);
    return row;
  }

  private async snapshotBody(skillId: string, version: number, body: string): Promise<void> {
    await this.db
      .insert(t.skillVersions)
      .values({ skillId, version, body })
      .onConflictDoNothing();
  }

  /** All body snapshots for a skill, newest version first. */
  async listVersions(skillId: string): Promise<SkillVersionRow[]> {
    return this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
  }

  /**
   * Run-level usage stats for a skill (see the `SkillStats` contract). Computed
   * from the association "this skill was pulled into a run's prompt" via
   * `run_skills`, never per-finding causation. Rates are null when there is no
   * data yet (denominator 0), which the UI renders as "—".
   */
  async stats(workspaceId: string, skillId: string): Promise<SkillStats> {
    // used_by_agents + agents_using — distinct agents in this workspace that
    // link the skill (agent_skills PK is (agent_id, skill_id), so already unique).
    const agentRows = await this.db
      .select({ agent_id: t.agents.id, name: t.agents.name })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(and(eq(t.agentSkills.skillId, skillId), eq(t.agents.workspaceId, workspaceId)))
      .orderBy(asc(t.agents.name));
    const agentsUsing = agentRows.map((r) => ({ agent_id: r.agent_id, name: r.name }));
    const agentIds = agentRows.map((r) => r.agent_id);

    // Runs (as a subquery) that pulled this skill — reused by the finding stats.
    const runsForSkill = this.db
      .select({ runId: t.runSkills.runId })
      .from(t.runSkills)
      .where(eq(t.runSkills.skillId, skillId));

    // pull_frequency — distinct runs that pulled this skill ÷ total runs of the
    // linking agents. Null when those agents have no runs at all.
    const pulledRows = await this.db
      .select({ pulled: countDistinct(t.runSkills.runId) })
      .from(t.runSkills)
      .where(eq(t.runSkills.skillId, skillId));
    const pulled = Number(pulledRows[0]?.pulled ?? 0);
    let totalRuns = 0;
    if (agentIds.length > 0) {
      const totalRows = await this.db
        .select({ total: count() })
        .from(t.agentRuns)
        .where(inArray(t.agentRuns.agentId, agentIds));
      totalRuns = Number(totalRows[0]?.total ?? 0);
    }
    const pullFrequency = totalRuns > 0 ? Math.min(1, pulled / totalRuns) : null;

    // accept_rate — accepted ÷ (accepted + dismissed) over findings from runs
    // that used this skill. Null when nothing has been resolved.
    const [resolved] = await this.db
      .select({
        accepted: sql<number>`count(*) filter (where ${t.findings.acceptedAt} is not null)`,
        dismissed: sql<number>`count(*) filter (where ${t.findings.dismissedAt} is not null)`,
      })
      .from(t.findings)
      .innerJoin(t.reviews, eq(t.findings.reviewId, t.reviews.id))
      .where(inArray(t.reviews.runId, runsForSkill));
    const accepted = Number(resolved?.accepted ?? 0);
    const dismissed = Number(resolved?.dismissed ?? 0);
    const acceptRate = accepted + dismissed > 0 ? accepted / (accepted + dismissed) : null;

    // findings_30d — findings from runs that used this skill whose run ran in the
    // last 30 days (findings have no timestamp; the run's ran_at stands in).
    const since = new Date(Date.now() - THIRTY_DAYS_MS);
    const recentRows = await this.db
      .select({ recent: count() })
      .from(t.findings)
      .innerJoin(t.reviews, eq(t.findings.reviewId, t.reviews.id))
      .innerJoin(t.agentRuns, eq(t.reviews.runId, t.agentRuns.id))
      .where(and(inArray(t.agentRuns.id, runsForSkill), gte(t.agentRuns.ranAt, since)));
    const recent = Number(recentRows[0]?.recent ?? 0);

    // by_category — histogram of finding categories over the same finding set.
    const categoryRows = await this.db
      .select({ category: t.findings.category, count: count() })
      .from(t.findings)
      .innerJoin(t.reviews, eq(t.findings.reviewId, t.reviews.id))
      .where(inArray(t.reviews.runId, runsForSkill))
      .groupBy(t.findings.category)
      .orderBy(desc(count()), asc(t.findings.category));

    return {
      used_by_agents: agentsUsing.length,
      agents_using: agentsUsing,
      pull_frequency: pullFrequency,
      accept_rate: acceptRate,
      findings_30d: recent,
      by_category: categoryRows.map((r) => ({ category: r.category, count: Number(r.count) })),
    };
  }
}
