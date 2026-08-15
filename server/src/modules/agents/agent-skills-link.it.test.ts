import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from '../../../test/helpers/pg.js';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../platform/config.js';
import { seed } from '../../db/seed.js';
import { MockEmbedder } from '../../adapters/mocks.js';
import * as t from '../../db/schema.js';
import { eq } from 'drizzle-orm';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

/**
 * Regression for the drag-reorder duplicate-PK bug: `setSkills` did a non-atomic
 * delete-then-insert, so two overlapping `POST /agents/:id/skills` (a single drag
 * fires `drop` + `dragend`) raced into `agent_skills_agent_id_skill_id_pk`. A
 * duplicate id in one payload hit the same PK. The repo now dedupes and replaces
 * inside a transaction.
 */
d('POST /agents/:id/skills — atomic + deduped (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    const { workspaceId: ws } = await seed(pg.handle.db);
    workspaceId = ws;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  async function makeAgentWithSkills() {
    const db = pg.handle.db;
    const [agent] = await db
      .insert(t.agents)
      .values({
        workspaceId,
        name: `link-agent-${Math.round(performance.now())}-${process.hrtime.bigint()}`,
        provider: 'openai',
        model: 'gpt-4.1',
        systemPrompt: 'x',
      })
      .returning();
    const skillRows = await db
      .insert(t.skills)
      .values(
        ['a', 'b', 'c'].map((n) => ({
          workspaceId,
          name: `sk-${n}-${process.hrtime.bigint()}`,
          description: '',
          type: 'rubric' as const,
          source: 'manual' as const,
          body: `body ${n}`,
        })),
      )
      .returning();
    return { agent: agent!, ids: skillRows.map((s) => s.id) };
  }

  it('dedupes a payload with a repeated skill id instead of violating the PK', async () => {
    const app = await buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: { embedder: new MockEmbedder() },
    });
    const { agent, ids } = await makeAgentWithSkills();

    const res = await app.inject({
      method: 'POST',
      url: `/agents/${agent.id}/skills`,
      // a duplicate id (ids[0] twice) would violate the PK without the dedupe
      payload: { skill_ids: [ids[0], ids[1], ids[0]] },
    });
    expect(res.statusCode).toBe(200);

    const rows = await pg.handle.db
      .select()
      .from(t.agentSkills)
      .where(eq(t.agentSkills.agentId, agent.id));
    expect(rows).toHaveLength(2); // deduped
    const ordered = rows.sort((x, y) => x.order - y.order).map((r) => r.skillId);
    expect(ordered).toEqual([ids[0], ids[1]]);
    await app.close();
  });

  it('handles two concurrent set-skills writes without a duplicate-PK error', async () => {
    const app = await buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: { embedder: new MockEmbedder() },
    });
    const { agent, ids } = await makeAgentWithSkills();

    // Two overlapping POSTs with the SAME ordered set — the drop+dragend double-fire.
    // Pre-fix this raced into agent_skills_agent_id_skill_id_pk; now both 200.
    const [r1, r2] = await Promise.all([
      app.inject({ method: 'POST', url: `/agents/${agent.id}/skills`, payload: { skill_ids: ids } }),
      app.inject({ method: 'POST', url: `/agents/${agent.id}/skills`, payload: { skill_ids: ids } }),
    ]);
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);

    const rows = await pg.handle.db
      .select()
      .from(t.agentSkills)
      .where(eq(t.agentSkills.agentId, agent.id));
    expect(rows).toHaveLength(ids.length);
    expect(rows.sort((x, y) => x.order - y.order).map((r) => r.skillId)).toEqual(ids);
    await app.close();
  });
});
