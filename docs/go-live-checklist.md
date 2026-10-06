# CampusVerse AI — Go-Live Checklist

Use this checklist before production deployment. Status from Phase 24 verification on the development host.

Legend: `[✓]` Verified live | `[!]` Requires external configuration | `[ ]` Not verified on current host

---

## Environment configuration

- [✓] `apps/api/.env.example` documents all required variables
- [✓] `apps/web/.env.example` documents `VITE_API_URL` and `VITE_SOCKET_PATH`
- [!] Production `POSTGRES_URI` aligned with running PostgreSQL (**auth failed for docker-compose credentials on port 5432**)
- [✓] `MONGODB_URI` connects (`localhost:27017`)
- [!] `REDIS_URI` — Redis not running on port 6379 (graceful degradation verified in code)
- [!] `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — set strong values in production (min 32 chars)
- [!] `GEMINI_API_KEY` — optional; not configured on verification host
- [!] `SEED_ADMIN_PASSWORD` / `SEED_DEMO_PASSWORD` — required for demo seed; not set in local `.env`
- [✓] Health/config endpoints do not leak secrets (`live-health-secrets.test.ts` — 3/3 pass)

## Database setup

- [✓] `npx prisma validate` — PASS
- [✓] `npx prisma generate` — PASS
- [ ] `npx prisma migrate status` — NOT VERIFIED (PostgreSQL auth failure)
- [ ] `npm run prisma:migrate:deploy` — NOT VERIFIED
- [✓] Baseline migration `0_init` present in repository

## Seed

- [ ] `npm run db:seed` — NOT VERIFIED (PostgreSQL unavailable)
- [ ] `npm run verify:seed` idempotency — NOT VERIFIED
- [✓] Seed script uses upsert/idempotent patterns (code review)
- [!] Demo credentials documented in `.env.example` only — never in source

## Docker / infrastructure

- [ ] `docker compose up -d` — NOT VERIFIED (Docker CLI not installed)
- [ ] API production image build — NOT VERIFIED
- [ ] Web production image build — NOT VERIFIED
- [✓] `docker-compose.yml` defines PostgreSQL, MongoDB, Redis services

## API startup

- [✓] `npm run build` (API) — PASS
- [ ] `npm run start` against live PostgreSQL — NOT VERIFIED
- [✓] `GET /api/v1/health` — verified (mock + secret leak tests)
- [✓] `GET /api/v1/health/config` — verified
- [ ] `GET /api/v1/health/ready` with live Postgres — NOT VERIFIED (ready returns 200 with mock DB)

## Frontend startup

- [✓] `npm run build` (web) — PASS
- [ ] Production static serve + browser verification — NOT VERIFIED (no live API)
- [✓] Phase 23 route/nav/profile UX complete (code review)

## HTTPS

- [!] Reverse proxy TLS termination — requires deployment environment
- [!] Secure cookie flags in production — configure at proxy + `NODE_ENV=production`

## Health checks

- [✓] Liveness endpoint documented
- [✓] Readiness endpoint documented
- [✓] Config diagnostics endpoint documented

## Redis

- [ ] Cache hit verification with Redis running — NOT VERIFIED
- [✓] Graceful degradation when Redis unavailable (code + infra probe)

## MongoDB

- [✓] Live connection — PASS
- [✓] Collections: Notification, AuditLog, Recommendation, TelemetryReading, AIConversation, AnalyticsSnapshot (6/6 tests)

## Socket.IO

- [ ] Live JWT handshake — NOT VERIFIED (requires PostgreSQL for user status)
- [✓] Architecture documented; multi-instance requires Redis adapter (not implemented)
- [✓] Frontend `RealtimeProvider` + token refresh sync (Phase 23)

## Gemini / AI

- [!] Live AI chat — GEMINI_API_KEY not configured
- [✓] Degraded state when key missing (unit tests + `/ai/status`)

## Backup / restore

- [ ] PostgreSQL backup script — NOT VERIFIED (bash; requires `pg_dump` + live DB)
- [ ] MongoDB backup script — NOT VERIFIED (bash; requires `mongodump`)
- [✓] Scripts documented in `scripts/backup/README.md`

## Rollback

- [!] Document: restore from backup + redeploy previous image tag
- [!] Never run destructive migrations without backup

## Monitoring

- [!] Configure log aggregation for Winston output
- [!] Alert on `/health/ready` returning 503
- [✓] Request IDs on all API responses

## Security checks

- [✓] No hardcoded API keys in source (grep audit)
- [✓] Mock Google OAuth blocked in production
- [✓] RBAC unit tests (18 suites)
- [ ] Live RBAC with seeded users — NOT VERIFIED (PostgreSQL)
- [✓] Rate limiting configured (Redis-backed when available)

## Automated tests (run before every deploy)

```bash
npx prisma validate
npx prisma generate
npm test                    # 18 UNIT suites
npm run test:integration    # 7 INTEGRATION suites (skip when infra missing)
npm run typecheck
npm run lint
npm run build
```

### Phase 24 test results (verification host)

| Category | Result |
|----------|--------|
| UNIT (`npm test`) | **18/18 suites PASS** |
| INTEGRATION (`npm run test:integration`) | **7/7 suites PASS** (4 skipped internally — no Postgres) |
| MongoDB live | **6/6 tests PASS** |
| Health/secret leak | **3/3 tests PASS** |
| Live HTTP journeys | **SKIPPED** — PostgreSQL auth |
| Live RBAC | **SKIPPED** — PostgreSQL auth |
| Live Socket.IO | **SKIPPED** — PostgreSQL auth |
| Live Redis API | **SKIPPED** — PostgreSQL auth |

## Go-live recommendation

**Conditional go-live:** Application code, unit tests, MongoDB integration, and production builds are verified. **Full go-live requires:**

1. Install Docker **or** align `POSTGRES_URI` with a reachable PostgreSQL instance matching `docker-compose.yml` credentials (`user` / database `campusverse`)
2. Set `SEED_ADMIN_PASSWORD` and `SEED_DEMO_PASSWORD`, run `npm run prisma:migrate:deploy` and `npm run db:seed`
3. Start Redis for distributed cache/rate limits (recommended)
4. Set production JWT secrets and `GEMINI_API_KEY` if AI is required
5. Re-run `npm run test:integration`, `npm run verify:seed`, and manual browser verification

See [`phase24_final_report.md`](../phase24_final_report.md) for full details.
