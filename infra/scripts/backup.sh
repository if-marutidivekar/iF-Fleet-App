#!/usr/bin/env bash
# ─── iF Fleet PostgreSQL Backup ──────────────────────────────────────────────
# Usage: bash infra/scripts/backup.sh [BACKUP_DIR]
# Requires: docker, pg_dump available via docker exec

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/fleet_db_$TIMESTAMP.sql.gz"
CONTAINER="${POSTGRES_CONTAINER:-if-fleet-app-postgres-1}"

mkdir -p "$BACKUP_DIR"

echo "Backing up fleet_db from container $CONTAINER…"

docker exec "$CONTAINER" pg_dump \
  -U "${POSTGRES_USER:-fleet_user}" \
  -d "${POSTGRES_DB:-fleet_db}" \
  --no-password \
  | gzip > "$BACKUP_FILE"

echo "Backup written to: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

# ── Retention: keep last 7 daily backups ──────────────────────────────────────
find "$BACKUP_DIR" -name "fleet_db_*.sql.gz" -mtime +7 -delete
echo "Cleanup: removed backups older than 7 days."
