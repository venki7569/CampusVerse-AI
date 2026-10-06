#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-directory>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="$1"

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

echo "Restoring MongoDB from $DIR"
mongorestore --uri="$MONGODB_URI" --drop "$DIR"
echo "Restore complete"
