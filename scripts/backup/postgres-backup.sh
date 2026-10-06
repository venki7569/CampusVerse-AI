#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups/postgres}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/campusverse-$STAMP.sql"

mkdir -p "$BACKUP_DIR"

if [ -f "$ROOT/apps/api/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/apps/api/.env"
  set +a
fi

if [ -z "${POSTGRES_URI:-}" ]; then
  echo "POSTGRES_URI is required" >&2
  exit 1
fi

echo "Backing up PostgreSQL to $OUT"
pg_dump "$POSTGRES_URI" --no-owner --no-acl -f "$OUT"
echo "Done: $OUT"
