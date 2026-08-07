# @yaghmori/storage-service

![stability-stable](https://img.shields.io/badge/stability-stable-green.svg)

Object storage microservice + Next.js admin — multi-tenant orgs, Local / MinIO / S3 providers, BullMQ processing, optional Kafka, TCP/HTTP APIs, npm + .NET SDKs.

> **Not for deployment artifacts.** Build outputs and release packages are out of scope.

## Monorepo layout

```text
apps/api          NestJS storage-service server (@yaghmori/storage-service-server)
apps/admin        Next.js admin UI (JWT, port 6200)
packages/client   npm SDK @yaghmori/storage-service (API key auth only)
packages/ui       @workspace/ui
packages/validation
packages/config-typescript
packages/config-eslint
```

## Auth split

| Surface | Auth |
| ------- | ---- |
| **Admin UI** `/admin/api/*` | Admin JWT (login → iron-session BFF, cookie `storage_admin_session`) |
| **Core HTTP** `/api/*` + SDK | Org-bound API key (`x-api-key`) + optional static `AUTH_API_KEYS` |
| **TCP / Kafka** | Network trust (unchanged) |

## Local development (recommended)

**API in Docker**, **admin on the host**:

```bash
pnpm install

# 1) API only — joins docker-services network `internal`
pnpm docker:dev
# HTTP http://localhost:6100  |  TCP :6001

# 2) Migrate + seed (creates DB if missing, applies schema, seeds if empty)
pnpm seed
# or separately: pnpm migrate && pnpm db:seed

# 3) Admin UI
pnpm dev
# http://localhost:6200  →  proxies to STORAGE_API_URL (default http://localhost:6100/api)
# Login: admin@example.com / admin (or ADMIN_EMAIL / ADMIN_PASSWORD)
```

Set `AUTH_DEFAULT_ORG_ID` to the seeded default org UUID so static `AUTH_API_KEYS` bind correctly.

### Database (create + migrate + seed)

On boot the app **creates the Postgres database** from `DATABASE_URL` when it does not exist (DB user needs `CREATEDB`). With `RUN_MIGRATIONS=true` / `RUN_SEED=true` it also migrates and seeds on first start.

```bash
# Preferred — one command: create DB + migrate + seed (skips seed data if already present)
docker exec <storage-service-container> seed
docker exec <storage-service-container> pnpm seed

# Schema only
docker exec <storage-service-container> migrate

# One-shot (same image / env; does not start the API)
docker compose run --rm storage-service seed

# Monorepo (dev)
pnpm seed
pnpm seed -- --force   # re-run org/provider seed even if data exists
```

Optional boot flags: `RUN_MIGRATIONS=true` and `RUN_SEED=true` (default off for multi-replica).

| Script | What runs |
| ------ | --------- |
| `pnpm docker:dev` | Nest API in Docker (`storage-service-api-dev`) |
| `pnpm migrate` / `pnpm db:migrate` | Create DB if needed + apply Drizzle migrations |
| `pnpm seed` / `pnpm db:seed` | Create DB + migrate + seed initial data if empty |
| `pnpm dev` | Next admin only |
| `pnpm dev:api` | Nest API on host |
| `pnpm dev:all` | Turbo: host API + admin |

## Ports

| Surface | Default (compose / admin) | SDK contract default |
| ------- | ------------------------- | -------------------- |
| HTTP | 6100 | 6100 |
| TCP | 6001 | 6001 |
| Admin | 6200 | — |

> **Note:** Do not use HTTP port **6000** — Node’s `fetch` (undici) blocks it as an X11 port (`bad port`).

## Admin features

Tenant (`/{orgSlug}/…`): Dashboard, Files, Jobs, Analytics, Providers, Tokens, Settings.  
Platform (`/~/…`): Organizations, Admin users, Account.

## SDK

```bash
cd packages/client && pnpm run codegen
```

Docs: `packages/client/docs/{PROTOCOL_GUIDE,USAGE,BEST_PRACTICES}.md`

## License

MIT
