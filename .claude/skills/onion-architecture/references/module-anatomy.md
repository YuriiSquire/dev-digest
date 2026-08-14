# Module anatomy

A feature is one `server/src/modules/<name>/` folder, registered once in
`modules/index.ts` (one import + one `app.register`). Inside, the code splits into
a small, fixed set of files — the three-layer stack `routes → service →
repository`, plus pure helpers and literals. `modules/repos/` is the canonical
example; every file below is quoted from it.

## The three layers

### `routes.ts` — transport only

A Fastify plugin. Its job is to parse and validate the request, resolve tenancy,
map status codes, and delegate. Its header states the boundary literally:
*"Transport layer only: parses requests, maps status codes, and delegates all
business logic to RepoService."*

```ts
export default async function reposRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new RepoService(app.container);

  app.post('/repos', { schema: { body: RepoInput } }, async (req, reply) => {
    const { workspaceId, userId } = await getContext(app.container, req);
    const { repo, created } = await service.add(workspaceId, userId, req.body.url);
    reply.status(created ? 201 : 200);
    return repo;
  });
}
```

Rules: declare Zod `params`/`body`/`response` schemas from `@devdigest/shared`
(invalid input is rejected `422` *before* the handler runs — never hand-roll
`Schema.parse(req.body)`); resolve `workspaceId`/`userId` with `getContext`; do no
business logic here.

### `service.ts` — business logic, no HTTP, no SQL

Orchestrates the feature and owns its repository. Header: *"No HTTP and no raw SQL
live here — persistence goes through RepoRepository, pure transforms through
helpers.ts, literals through constants.ts."* It takes the `Container` in its
constructor and reaches external systems and cross-module data through it
(`container.git`, `container.jobs`, `container.secrets`, `container.repoIntel`):

```ts
export class RepoService {
  private repo: RepoRepository;
  constructor(private container: Container) {
    this.repo = new RepoRepository(container.db);
  }
  async add(workspaceId: string, userId: string, url: string) {
    const { owner, name } = parseRepoUrl(url);           // pure helper
    const existing = await this.repo.findByFullName(workspaceId, `${owner}/${name}`);
    if (existing) return { repo: toRepoDto(existing), created: false };
    const row = await this.repo.insert({ workspaceId, owner, name, /* … */ });
    await this.container.jobs.enqueue(workspaceId, CLONE_JOB_KIND, { /* … */ });
    return { repo: toRepoDto(row), created: true };
  }
}
```

### `repository.ts` — the only Drizzle layer

Every query for the module's table lives here, and each is scoped by
`workspaceId` (the tenancy guard). Header: *"The ONLY place that touches the
`repos` table."* It receives the `Db` handle by constructor injection — that
handle is the seam tests swap:

```ts
export class RepoRepository {
  constructor(private db: Db) {}
  async findByFullName(workspaceId: string, fullName: string): Promise<RepoRow | undefined> {
    const [row] = await this.db.select().from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.fullName, fullName)));
    return row;
  }
}
```

`drizzle-orm` is imported here and nowhere else in the module. A service that
imports `drizzle-orm` or writes `sql\`…\`` is a layering violation — push it down.

## The supporting files

- `helpers.ts` — pure transforms and DTO mappers (`parseRepoUrl`, `toRepoDto`). No
  I/O, no state; trivially unit-testable.
- `constants.ts` — literals (job kinds, depths, secret names). Cross-module
  constants (e.g. `repo-intel`'s `INDEX_JOB_KIND`) are imported from the owning
  module's `constants.ts`, which is the one sanctioned cross-module import.
- `types.ts` — module-local types. Usually row/DTO types; occasionally a **facade
  interface** (see below).

## The facade variant — when a module hides real complexity

Most modules expose a `service.ts` class directly. A module that wraps heavy
libraries exposes a **port interface** instead, so consumers never see the
libraries. `repo-intel` is the example: `types.ts` declares the `RepoIntel`
interface — *"the SINGLE interface every feature codes against … features import
THIS, never the libraries"* (ast-grep, dependency-cruiser, graphology). Its
`service.ts` implements the interface, and the container returns it **by interface
type** (`get repoIntel(): RepoIntel`), so tests can inject a mock `RepoIntel`.
Reach for this only when internals are genuinely complex; a plain three-layer
module does not need it.

## Checklist — adding a new module

1. Create `server/src/modules/<name>/` with `routes.ts`, `service.ts`,
   `repository.ts` (+ `helpers.ts`, `constants.ts`, `types.ts` as needed).
2. Put request/response schemas in `@devdigest/shared` and reference them in
   `routes.ts`; keep handlers thin and delegate to the service.
3. Keep all business logic in the service; keep all Drizzle in the repository,
   every query `workspaceId`-scoped.
4. Reach external systems and other modules only through the injected `Container`.
5. Register the module in `modules/index.ts` (one import + one `app.register`).
6. If the module needs a new table, edit `db/schema.ts` → `pnpm db:generate` →
   `pnpm db:migrate` (migrations are append-only — never hand-edit one).

## Sources

- Sairyss — *Domain-Driven Hexagon* (layer import rules): <https://dev.to/sairyss/domain-driven-hexagon-18g5>
- André Bazaglia — *Clean Architecture with TypeScript: DDD, Onion*: <https://bazaglia.com/clean-architecture-with-typescript-ddd-onion/>
- DevDigest source: `server/src/modules/repos/{routes,service,repository}.ts`, `server/src/modules/repo-intel/types.ts`, `server/CLAUDE.md`.
