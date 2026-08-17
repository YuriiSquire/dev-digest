import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { AppError, ConfigError } from '../../platform/errors.js';
import { ConventionsService } from './service.js';

/**
 * Conventions Extractor module.
 *   POST /repos/:id/conventions/extract  → scan (LLM + evidence gate); replaces the set
 *   GET  /repos/:id/conventions          → list candidates for a repo
 *   POST /conventions/:id/(accept|reject)→ set lifecycle status
 *   PUT  /conventions/:id                → edit rule/category/evidence
 *   POST /repos/:id/conventions/skill    → bundle accepted → one convention skill
 */

const STATUS_ACTIONS = { accept: 'accepted', reject: 'rejected' } as const;

const UpdateConventionBody = z.object({
  category: z.string().optional(),
  rule: z.string().min(1).optional(),
  evidence_path: z.string().optional(),
  evidence_snippet: z.string().optional(),
});

const CreateConventionSkillBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: SkillType.optional(),
  body: z.string().min(1),
  enabled: z.boolean().optional(),
  convention_ids: z.array(z.string().uuid()).min(1),
});

export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ConventionsService(app.container);

  // Extract makes an LLM call — tight per-route limit like POST /pulls/:id/review.
  app.post(
    '/repos/:id/conventions/extract',
    { schema: { params: IdParams }, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      try {
        const { candidates, sampleCount } = await service.extract(workspaceId, req.params.id);
        return { candidates, sample_count: sampleCount };
      } catch (err) {
        // A missing provider key is a configuration problem, not a server crash —
        // surface it as a clear 4xx rather than a 500.
        if (err instanceof ConfigError) {
          throw new AppError('llm_not_configured', err.message, 400);
        }
        throw err;
      }
    },
  );

  app.get('/repos/:id/conventions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId, req.params.id);
  });

  for (const [action, status] of Object.entries(STATUS_ACTIONS)) {
    app.post(`/conventions/:id/${action}`, { schema: { params: IdParams } }, async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.setStatus(workspaceId, req.params.id, status);
    });
  }

  app.put(
    '/conventions/:id',
    { schema: { params: IdParams, body: UpdateConventionBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const body = req.body;
      return service.update(workspaceId, req.params.id, {
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.rule !== undefined ? { rule: body.rule } : {}),
        ...(body.evidence_path !== undefined ? { evidencePath: body.evidence_path } : {}),
        ...(body.evidence_snippet !== undefined ? { evidenceSnippet: body.evidence_snippet } : {}),
      });
    },
  );

  app.post(
    '/repos/:id/conventions/skill',
    { schema: { params: IdParams, body: CreateConventionSkillBody } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const body = req.body;
      const skill = await service.createSkill(workspaceId, req.params.id, {
        name: body.name,
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        body: body.body,
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        conventionIds: body.convention_ids,
      });
      reply.status(201);
      return skill;
    },
  );
}
