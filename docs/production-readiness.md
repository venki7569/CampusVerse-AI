# CampusVerse AI — Production Readiness Guide

This document summarizes deployment requirements, configuration, and operational behavior for CampusVerse AI after Phase 23.

## Architecture summary

| Layer | Technology |
|-------|------------|
| API | Express 5, TypeScript, Zod, Prisma 7 + `@prisma/adapter-pg` |
| Web | React 19, Vite, TanStack Query, Tailwind |
| Primary DB | PostgreSQL |
| Document DB | MongoDB (notifications, audit, AI, analytics, IoT telemetry) |
| Cache | Redis (optional — graceful degradation) |
| Realtime | Socket.IO (JWT auth, in-process event bridge) |
| AI | Gemini (optional — read-only grounded tools) |

REST is authoritative. Socket.IO and Redis are enhancement layers — the API continues when they are unavailable.

## Environment variables

Copy `apps/api/.env.example` and `apps/web/.env.example`. Never commit `.env` files.

### Required in production

| Variable | Purpose |
|----------|---------|
| `POSTGRES_URI` | PostgreSQL connection string |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Min 32 chars, not a demo/default value |
| `JWT_REFRESH_SECRET` | Min 32 chars, not a demo/default value |
| `CORS_ORIGIN` | Frontend origin (HTTPS in production) |
| `NODE_ENV=production` | Enables production validation |

### Optional integrations

| Variable | When needed |
|----------|-------------|
| `REDIS_URI` | Distributed cache + rate limits (recommended multi-instance) |
| `GEMINI_API_KEY` | AI assistant |
| `SOCKET_ENABLED=false` | Disable realtime if not used |
| `REDIS_ENABLED=false` | Force in-memory fallbacks |

### Development only

| Variable | Notes |
|----------|-------|
| `SEED_ADMIN_PASSWORD` / `SEED_DEMO_PASSWORD` | Demo seed only |
| `OCCUPANCY_SIMULATION_ENABLED` | **Blocked in production** at startup |
| Mock Google OAuth | **Blocked in production** — `/auth/google` returns 403 |

### Not wired

- `CLOUDINARY_*` — placeholders only; file uploads not implemented

## Configuration diagnostics

Safe configuration summary (no secrets):

```bash
curl http://localhost:5000/api/v1/health/config
```

Startup logs include integration flags without secret values.

Production validation runs at boot via `validateEnvironment()` — fails fast on insecure JWT secrets, missing required vars, or occupancy simulation in production.

## Deployment sequence

1. **Infrastructure:** PostgreSQL, MongoDB, Redis (recommended), reverse proxy with HTTPS + WebSocket upgrade
2. **Configure env:** Strong JWT secrets, production `CORS_ORIGIN`, `VITE_API_URL` at web build time
3. **Database:**
   ```bash
   npm run prisma:generate
   npm run prisma:validate
   npm run prisma:migrate:deploy
   ```
4. **Seed (first deploy only):**
   ```bash
   SEED_ADMIN_PASSWORD=... SEED_DEMO_PASSWORD=... npm run db:seed
   ```
5. **Build & start:**
   ```bash
   npm run build
   npm run start --workspace=apps/api
   # Serve apps/web/dist via nginx or CDN
   ```
6. **Verify:**
   ```bash
   npm run verify:infra
   curl /api/v1/health/ready
   ```

## Health checks

| Endpoint | Use |
|----------|-----|
| `GET /api/v1/health` | Liveness |
| `GET /api/v1/health/ready` | Readiness (Postgres required; Mongo/Redis/Gemini degrade gracefully) |
| `GET /api/v1/health/config` | Safe config summary |
| `GET /api/v1/admin/system-health` | Admin UI (requires admin role) |

## Database migration

- Baseline: `apps/api/prisma/migrations/0_init/`
- **Production:** `npm run prisma:migrate:deploy` — never `db push`
- **Development:** `prisma migrate dev` or `prisma db push` for local iteration

## Seed process

Idempotent demo seed creates users, campus hierarchy, maintenance lifecycle, utilities, parking, announcements, IoT devices, MongoDB notifications/recommendations.

Document credentials in ops runbooks — not in source code.

## Backup strategy

See [`scripts/backup/README.md`](../scripts/backup/README.md) for PostgreSQL and MongoDB backup/restore scripts.

## Redis requirements

| Mode | Behavior |
|------|----------|
| Available | Dashboard/analytics/unread caches; distributed rate limits |
| Unavailable | In-memory rate limits; cache no-ops; API fully functional |

**Single-instance:** Redis optional. **Multi-instance:** Redis required for consistent rate limits and shared cache.

## Socket.IO scaling

Current implementation uses in-process Socket.IO without Redis adapter.

- **Single node:** Works out of the box
- **Multi-node:** Requires `@socket.io/redis-adapter` (documented limitation — not implemented)

Rooms: `user:{id}`, `campus:updates`, `role:{name}`. JWT + active-user check at handshake.

## AI configuration

- Set `GEMINI_API_KEY` for live assistant
- Without key: `/ai/status` reports unavailable; readiness `degraded`
- All tools are **read-only**; RBAC enforced per tool; no autonomous mutations

## Monitoring & logging

- Winston structured logs with module context
- Request IDs via `X-Request-Id`
- Errors: consistent `{ success, error: { code, message, details }, requestId }` — no stack traces in production responses
- Startup logs configuration state without secrets

## Security checklist

- [ ] Strong JWT secrets (32+ chars, unique per environment)
- [ ] HTTPS + secure cookies for refresh tokens
- [ ] Production `CORS_ORIGIN` locked to frontend domain
- [ ] Redis and Postgres not publicly exposed
- [ ] Seed passwords from env only
- [ ] Mock Google OAuth disabled (automatic in production)
- [ ] Rate limits enabled (Redis recommended at scale)
- [ ] `npm test` passes before deploy

See also [`docs/security/permission-matrix.md`](security/permission-matrix.md).

## Testing

| Category | Command | Notes |
|----------|---------|-------|
| **UNIT** | `npm test` | 18 suites — mock DB, always run in CI |
| **INTEGRATION** | `npm run test:integration` | 7 suites — live Mongo/Postgres/Redis/Socket |
| Infra probe | `npm run verify:infra` | Exits 1 if Postgres or Mongo unreachable |
| Seed idempotency | `npm run verify:seed` | Requires Postgres + seed passwords |

```bash
npm test
npm run test:integration
npm run verify:infra
npm run verify:seed
npm run typecheck
npm run lint
npm run build
```

Integration suites skip gracefully when PostgreSQL is unavailable. See [`go-live-checklist.md`](go-live-checklist.md) for Phase 24 verification status.

## Known limitations

- Announcement scheduling: lazy promotion (no background worker)
- Notification fan-out: synchronous
- Socket.IO multi-instance: requires Redis adapter (future)
- Password reset: in-memory token store in dev (no email infra)
- Access token in localStorage (documented XSS consideration)
- Cloudinary not wired
- Live E2E against PostgreSQL requires aligned credentials + migrated DB

## Recommended future work

- Redis adapter for Socket.IO horizontal scaling
- Real Google OAuth verification
- Email delivery for password reset
- Background workers for announcement scheduling
- Cloudinary or S3 file upload integration
- httpOnly access token or BFF pattern for XSS hardening
