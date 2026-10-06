# Integration Verification (Phase 23)

## Quick checks

```bash
# From repository root
npm run verify:infra      # Probe Postgres, MongoDB, Redis
npm run test              # Unit + mock E2E (17 suites)
npm run test:integration  # Live Mongo + HTTP (requires Postgres + Mongo)
```

## Required services

| Service | Default URI | Required for |
|---------|-------------|--------------|
| PostgreSQL | `postgresql://user:password@localhost:5432/campusverse` | API, seed, live HTTP tests |
| MongoDB | `mongodb://localhost:27017/campusverse` | Notifications, audit, AI, telemetry |
| Redis | `redis://localhost:6379` | Optional — graceful fallback |

Start with Docker:

```bash
npm run docker:up
cd apps/api
npm run prisma:migrate:deploy
SEED_ADMIN_PASSWORD=... SEED_DEMO_PASSWORD=... npm run db:seed
```

## Environment alignment

Ensure `apps/api/.env` includes:

- `POSTGRES_URI` matching your Postgres credentials
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (min 32 chars)
- `MONGODB_URI`
- `SEED_ADMIN_PASSWORD` / `SEED_DEMO_PASSWORD` for demo login tests

Do **not** commit `.env` or log passwords.

## Prisma 7 driver

The API uses `@prisma/adapter-pg` via `createPrismaClient()` in `src/database/prisma.client.ts`.

## Backup verification

See [`scripts/backup/README.md`](../../scripts/backup/README.md).
