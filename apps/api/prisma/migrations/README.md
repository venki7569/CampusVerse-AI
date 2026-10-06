# Prisma Migrations

CampusVerse uses PostgreSQL with Prisma 7 and the `@prisma/adapter-pg` driver.

## Fresh database (recommended)

```bash
cd apps/api
npm run prisma:generate
npm run prisma:migrate:deploy   # applies migrations/0_init
npm run db:seed                 # requires SEED_* env vars
```

The baseline migration `0_init` contains the complete schema (Phases 1–20 including IoT).

## Development (schema sync without history)

```bash
cd apps/api
npm run prisma:push
npm run prisma:generate
```

## Production

```bash
npm run prisma:migrate:deploy
```

Never run destructive reset commands against production data.

## Upgrading from `db push` only

If your database was created with `db push` before migrations existed:

```bash
npx prisma migrate resolve --applied 0_init
```

## Integration verification

```bash
npm run verify:infra          # from repo root
npm run test:integration      # live HTTP + Mongo tests (requires Postgres + Mongo)
```

Align `POSTGRES_URI` with `docker-compose.yml` (`user:password@localhost:5432/campusverse`).
