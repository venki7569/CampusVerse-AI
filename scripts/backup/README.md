# Backup & Restore Scripts

These scripts are for **development/staging** operations. Do not run against production without a verified backup plan.

## PostgreSQL

### Backup
```bash
# From repo root (requires pg_dump in PATH)
./scripts/backup/postgres-backup.sh
```

### Restore
```bash
./scripts/backup/postgres-restore.sh backups/postgres/campusverse-YYYYMMDD-HHMMSS.sql
```

## MongoDB

### Backup
```bash
./scripts/backup/mongo-backup.sh
```

### Restore
```bash
./scripts/backup/mongo-restore.sh backups/mongo/campusverse-YYYYMMDD-HHMMSS
```

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `POSTGRES_URI` | from `.env` | PostgreSQL connection |
| `MONGODB_URI` | from `.env` | MongoDB connection |
| `BACKUP_DIR` | `./backups` | Output directory |

See also [`docs/operations/data-retention.md`](../docs/operations/data-retention.md).
