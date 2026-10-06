# CampusVerse AI

Enterprise smart campus operations platform — facilities, utilities, maintenance, parking, analytics, notifications, announcements, and an AI assistant.

## Architecture

| Layer | Technology |
|-------|------------|
| API | Express 5, TypeScript, Zod, Swagger |
| Web | React 19, Vite, TanStack Query v5, Tailwind |
| Primary DB | PostgreSQL (Prisma ORM) |
| Document DB | MongoDB (notifications, audit, AI, analytics snapshots) |
| Cache | Redis (optional — graceful degradation) |
| Realtime | Socket.IO (JWT-authenticated, event-bridge from domain buses) |
| Auth | JWT + RBAC permissions |
| AI | Gemini provider abstraction |

## Repository structure

```
apps/
  api/          REST + Socket.IO backend
  web/          React frontend
docker-compose.yml   PostgreSQL, MongoDB, Redis
```

## Prerequisites

- Node.js 20+
- Docker (recommended for PostgreSQL, MongoDB, Redis)
- Gemini API key (optional — AI features degrade gracefully)

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start infrastructure

```bash
npm run docker:up
# or: docker compose up -d
```

### 3. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edit secrets — **never commit `.env` files**.

### 4. Database

```bash
npm run prisma:generate
npm run prisma:validate
cd apps/api && npm run prisma:push   # dev sync
# or: npm run prisma:migrate:dev -- --name init
```

### 5. Seed demo data

```bash
npm run db:seed
```

Requires `SEED_ADMIN_PASSWORD` and optionally `SEED_DEMO_PASSWORD` in `apps/api/.env`.

### 6. Run development servers

```bash
npm run dev:api   # http://localhost:5000
npm run dev:web   # http://localhost:5173
```

API docs: http://localhost:5000/api/v1/docs

## Environment variables

See `apps/api/.env.example` and `apps/web/.env.example`.

| Variable | Required | Notes |
|----------|----------|-------|
| `POSTGRES_URI` | Production | PostgreSQL connection |
| `MONGODB_URI` | Production | MongoDB connection |
| `JWT_ACCESS_SECRET` | Production | Min 32 chars |
| `JWT_REFRESH_SECRET` | Production | Min 32 chars |
| `CORS_ORIGIN` | Production | Frontend origin |
| `REDIS_URI` | Optional | Cache + distributed rate limits |
| `GEMINI_API_KEY` | Optional | AI assistant |
| `SOCKET_ENABLED` | Optional | Default `true` |

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | API + web (parallel) |
| `npm test` | Unit + mock E2E suites (18) |
| `npm run test:integration` | Live integration suites (7) — Mongo, health, HTTP journeys when Postgres available |
| `npm run verify:infra` | Probe Postgres, MongoDB, Redis |
| `npm run verify:seed` | Double-run seed idempotency check (requires Postgres) |
| `npm run typecheck` | TypeScript (api + web) |
| `npm run lint` | Frontend oxlint |
| `npm run build` | Production builds |
| `npm run db:seed` | Idempotent demo seed |

## Realtime architecture

Domain modules emit transport-agnostic events (`dashboard.events`, `notification.events`, etc.). Phase 18 wires a Socket.IO **event bridge** that forwards sanitized envelopes to:

- `user:{userId}` — notifications, AI, announcement reads
- `campus:updates` — dashboard, parking, analytics, maintenance, announcements

REST remains authoritative. Socket failures never break API operations.

Frontend `RealtimeProvider` connects with JWT, invalidates TanStack Query caches on events.

## Redis behavior

When Redis is available:

- Dashboard overview, analytics overview, notification unread count cached (short TTL)
- Rate limiters use Redis store (multi-instance safe)

When unavailable, the API continues with in-memory fallbacks.

## Health checks

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/health` | Liveness |
| `GET /api/v1/health/ready` | Readiness (Postgres, Mongo, Redis, Socket, Gemini status) |
| `GET /api/v1/health/config` | Safe configuration diagnostics (no secrets) |

## RBAC overview

Roles: `SUPER_ADMIN`, `CAMPUS_ADMIN`, `DEPARTMENT_ADMIN`, `FACULTY`, `STUDENT`, `MAINTENANCE_STAFF`, `SECURITY_STAFF`.

Permissions are loaded from the database per request — JWT carries roles only.

Permissions are loaded from the database per request — JWT carries roles only. See `docs/security/permission-matrix.md`.

See [`docs/go-live-checklist.md`](docs/go-live-checklist.md) for Phase 24 go-live verification status.

See [`docs/production-readiness.md`](docs/production-readiness.md) for deployment checklist.

See [`docs/operations/integration-verification.md`](docs/operations/integration-verification.md).

## Testing

| Suite | Path | Coverage |
|-------|------|----------|
| Module unit tests | `apps/api/src/modules/**/*.test.ts` | Service-layer logic |
| Security tests | `apps/api/src/test/security.test.ts` | Hardening verification |
| Department scope tests | `apps/api/src/test/department-scope.test.ts` | RBAC department filtering |
| Auth profile tests | `apps/api/src/test/auth-profile.test.ts` | Profile/password endpoints |
| E2E HTTP tests | `apps/api/src/test/e2e.test.ts` | Auth boundaries via supertest |
| Production tests | `apps/api/src/modules/production/production.test.ts` | Health, cache, socket |

Run all: `npm test` from `apps/api` or root.

## Demo seed

Set `SEED_DEMO_PASSWORD` and `SEED_ADMIN_PASSWORD` (see `.env.example`), then:

```bash
npm run db:seed
```

Creates idempotent demo users, campus hierarchy, maintenance lifecycle samples, utilities history, IoT devices, announcements, and MongoDB notifications/recommendations.

## Backup scripts

See [`scripts/backup/README.md`](scripts/backup/README.md) for PostgreSQL and MongoDB backup/restore.

## Docker production build

```bash
docker build -f apps/api/Dockerfile -t campusverse-api .
docker build -f apps/web/Dockerfile -t campusverse-web \
  --build-arg VITE_API_URL=https://api.example.com/api/v1 .
```

## Production deployment notes

1. Set strong JWT secrets and production `CORS_ORIGIN`
2. Run `npm run prisma:migrate:deploy` (not `db push`)
3. Seed admin via env vars only — never hardcode passwords
4. Enable Redis for cache and distributed rate limiting
5. Configure reverse proxy for HTTPS and WebSocket upgrade
6. Set `NODE_ENV=production`

## Known limitations

- Announcement scheduling uses lazy promotion (no background worker)
- Notification fan-out is synchronous
- Socket.IO scaling across nodes requires Redis adapter (future enhancement)

## License

ISC
