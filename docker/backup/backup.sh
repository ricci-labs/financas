#!/bin/sh
set -eu

: "${BACKUP_DIR:?Set BACKUP_DIR to the folder that keeps the backups}"
: "${BACKUP_DB_CONTAINER:?Set BACKUP_DB_CONTAINER to the database container name (or a prefix)}"
DB_NAME="${BACKUP_DB_NAME:-financas}"
DB_USER="${BACKUP_DB_USER:-postgres}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
REMOTE_KEEP_DAYS="${BACKUP_REMOTE_KEEP_DAYS:-30}"
FILES_PATH="${BACKUP_FILES_PATH:-/data/files}"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$BACKUP_DIR/financas-db-$stamp.dump"
files="$BACKUP_DIR/financas-files-$stamp.tar.gz"

push_heartbeat() {
  if [ -n "${BACKUP_KUMA_PUSH_URL:-}" ]; then
    curl -fsS -m 10 -G "$BACKUP_KUMA_PUSH_URL" \
      --data-urlencode "status=$1" --data-urlencode "msg=$2" >/dev/null || true
  fi
}

fail() {
  echo "Backup failed: $1" >&2
  rm -f "$dump.partial" "$files.partial"
  push_heartbeat down "$1"
  exit 1
}

container_named() {
  docker ps --filter "name=$1" --format '{{.Names}}' | head -n 1
}

umask 077
mkdir -p "$BACKUP_DIR"

db_container="$(container_named "$BACKUP_DB_CONTAINER")"
[ -n "$db_container" ] || fail "no running container matches $BACKUP_DB_CONTAINER"

docker exec "$db_container" pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom \
  >"$dump.partial" || fail "pg_dump of $DB_NAME failed"
docker exec -i "$db_container" pg_restore --list <"$dump.partial" >/dev/null \
  || fail "the dump can't be read back"
mv "$dump.partial" "$dump"

if [ -n "${BACKUP_APP_CONTAINER:-}" ]; then
  app_container="$(container_named "$BACKUP_APP_CONTAINER")"
  [ -n "$app_container" ] || fail "no running container matches $BACKUP_APP_CONTAINER"
  docker exec "$app_container" tar -czf - -C "$FILES_PATH" . >"$files.partial" \
    || fail "archiving $FILES_PATH failed"
  mv "$files.partial" "$files"
fi

find "$BACKUP_DIR" -maxdepth 1 -name 'financas-*' -type f -mtime "+$KEEP_DAYS" -delete

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  command -v rclone >/dev/null || fail "BACKUP_RCLONE_REMOTE is set but rclone is not installed"
  rclone copy "$BACKUP_DIR" "$BACKUP_RCLONE_REMOTE" --include "financas-*-$stamp.*" \
    || fail "copy to $BACKUP_RCLONE_REMOTE failed"
  rclone delete "$BACKUP_RCLONE_REMOTE" --include 'financas-*' --min-age "${REMOTE_KEEP_DAYS}d" \
    || fail "pruning $BACKUP_RCLONE_REMOTE failed"
fi

push_heartbeat up "OK $stamp"
echo "Backup $stamp written to $BACKUP_DIR"
