# Data Retention & Backup

## MongoDB TTL / Retention

| Collection | Retention | Mechanism |
|------------|-----------|-----------|
| `TelemetryReading` | 90 days | MongoDB TTL index on `createdAt` |
| `AuditLog` | No TTL | Operational audit — configure backup policy |
| `Notification` | No TTL | Application-level; archive manually |
| `AIConversation` | No TTL | User-managed delete via API |
| `AnalyticsSnapshot` | No TTL | Historical analytics |
| `Recommendation` | No TTL | Lifecycle states OPEN→RESOLVED |
| `OperationalAction` | No TTL | Workflow audit trail |

## PostgreSQL

- Authoritative relational data (users, assets, meters, devices, maintenance).
- No automatic row TTL. Use standard PostgreSQL backup (pg_dump, WAL archiving).

## Redis

- Ephemeral cache, rate limits, IoT dedup keys — **not authoritative**.
- Safe to flush; data rebuilds from PostgreSQL/MongoDB.

## Backup Recommendations

1. **PostgreSQL**: Daily logical backups; test restore quarterly.
2. **MongoDB**: `mongodump` for notifications, audit, AI, telemetry archives.
3. **Secrets**: Store in environment/secret manager — never in git.
4. **Redis**: Optional RDB snapshots if rate-limit state matters across restarts.

## Restore Order

1. PostgreSQL schema (`prisma migrate deploy`)
2. PostgreSQL data
3. MongoDB collections
4. Redis (optional — repopulates via traffic)
