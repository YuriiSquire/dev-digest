import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { SkillsService } from './service.js';

/**
 * A1 — skills module.
 *   GET    /skills            → list (workspace-scoped)
 *   GET    /skills/:id        → one skill
 *   POST   /skills            → create (source 'manual')
 *   PUT    /skills/:id        → update (a body change versions it)
 *   DELETE /skills/:id        → delete
 *   POST   /skills/import     → paste-text / url / community (lands disabled)
 *   GET    /skills/community  → catalog search
 *   POST   /skills/tokens     → live body token count
 *   GET    /skills/:id/stats  → run-level usage stats
 */

const CreateSkillBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: SkillType.optional(),
  body: z.string().min(1),
  enabled: z.boolean().optional(),
  evidence_files: z.array(z.string()).nullish(),
});

const UpdateSkillBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: SkillType.optional(),
  body: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

/** Import is one of three shapes, discriminated by `kind`. */
const ImportBody = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    name: z.string().optional(),
    body: z.string().min(1),
    type: SkillType.optional(),
  }),
  z.object({ kind: z.literal('url'), url: z.string().min(1) }),
  z.object({ kind: z.literal('community'), name: z.string().min(1) }),
]);

const CommunityQuery = z.object({
  q: z.string().optional(),
  lang: z.string().optional(),
});

const TokensBody = z.object({ text: z.string() });

export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService(app.container);

  app.get('/skills', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  // Static/catalog routes are declared before `/skills/:id` so they win over the
  // param route (Fastify's radix router handles this, but the ordering is clear).
  app.get('/skills/community', { schema: { querystring: CommunityQuery } }, async (req) => {
    await getContext(app.container, req);
    return service.listCommunity(req.query.q, req.query.lang);
  });

  app.post('/skills/tokens', { schema: { body: TokensBody } }, async (req) => {
    await getContext(app.container, req);
    return { tokens: service.countTokens(req.body.text) };
  });

  app.post('/skills/import', { schema: { body: ImportBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const body = req.body;
    let skill;
    if (body.kind === 'text') {
      skill = await service.importFromText(workspaceId, {
        body: body.body,
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
      });
    } else if (body.kind === 'url') {
      skill = await service.importFromUrl(workspaceId, { url: body.url });
    } else {
      skill = await service.importFromCommunity(workspaceId, body.name);
    }
    reply.status(201);
    return skill;
  });

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.get(workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.post('/skills', { schema: { body: CreateSkillBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const body = req.body;
    const skill = await service.create(workspaceId, {
      name: body.name,
      body: body.body,
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.evidence_files !== undefined ? { evidence_files: body.evidence_files } : {}),
    });
    reply.status(201);
    return skill;
  });

  app.put('/skills/:id', { schema: { params: IdParams, body: UpdateSkillBody } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.update(workspaceId, req.params.id, req.body);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const ok = await service.delete(workspaceId, req.params.id);
    if (!ok) throw new NotFoundError('Skill not found');
    return { ok: true };
  });

  app.get('/skills/:id/stats', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const stats = await service.stats(workspaceId, req.params.id);
    if (!stats) throw new NotFoundError('Skill not found');
    return stats;
  });
}
