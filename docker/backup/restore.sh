#!/bin/sh
set -eu

usage() {
  echo "Usage: RESTORE_CONFIRM=<database> restore.sh <db dump> [files archive]" >&2
  exit 2
}

[ $# -ge 1 ] || usage
: "${BACKUP_DB_CONTAINER:?Set BACKUP_DB_CONTAINER to the database container name (or a prefix)}"
DB_NAME="${RESTORE_DB_NAME:-financas}"
DB_USER="${BACKUP_DB_USER:-postgres}"
DB_OWNER="${RESTORE_DB_OWNER:-financas_owner}"
FILES_PATH="${BACKUP_FILES_PATH:-/data/files}"
dump="$1"
files="${2:-}"

if [ "${RESTORE_CONFIRM:-}" != "$DB_NAME" ]; then
  echo "This drops and recreates the database $DB_NAME. Run again with RESTORE_CONFIRM=$DB_NAME." >&2
  exit 1
fi
[ -f "$dump" ] || { echo "No dump at $dump" >&2; exit 1; }

container_named() {
  docker ps --filter "name=$1" --format '{{.Names}}' | head -n 1
}

db_container="$(container_named "$BACKUP_DB_CONTAINER")"
[ -n "$db_container" ] || { echo "No running container matches $BACKUP_DB_CONTAINER" >&2; exit 1; }

docker exec "$db_container" dropdb -U "$DB_USER" --if-exists --force "$DB_NAME"
docker exec "$db_container" createdb -U "$DB_USER" --owner="$DB_OWNER" "$DB_NAME"
docker exec -i "$db_container" pg_restore -U "$DB_USER" -d "$DB_NAME" \
  --single-transaction --exit-on-error <"$dump"
echo "Database $DB_NAME restored from $dump"

if [ -n "$files" ]; then
  : "${BACKUP_APP_CONTAINER:?Set BACKUP_APP_CONTAINER to restore the attachments}"
  app_container="$(container_named "$BACKUP_APP_CONTAINER")"
  [ -n "$app_container" ] || { echo "No running container matches $BACKUP_APP_CONTAINER" >&2; exit 1; }
  docker exec -i "$app_container" tar -xzf - -C "$FILES_PATH" <"$files"
  echo "Attachments restored into $FILES_PATH from $files"
fi
