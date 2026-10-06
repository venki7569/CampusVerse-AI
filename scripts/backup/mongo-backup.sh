#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups/mongo}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/campusverse-$STAMP"

mkdir -p "$BACKUP_DIR"

if [ -f "$ROOT/apps/api/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/apps/api/.env"
  set +a
fi

if [ -z "${MONGODB_URI:-}" ]; then
  echo "MONGODB_URI is required" >&2
  exit 1
fi

echo "Backing up MongoDB to $OUT"
mongodump --uri="$MONGODB_URI" --out="$OUT"
echo "Done: $OUT"
