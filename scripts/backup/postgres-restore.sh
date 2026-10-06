#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup.sql>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILE="$1"

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

echo "Restoring PostgreSQL from $FILE"
psql "$POSTGRES_URI" -f "$FILE"
echo "Restore complete"
