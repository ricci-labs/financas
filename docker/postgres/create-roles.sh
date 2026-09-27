#!/bin/sh
set -eu

prefix="${1:?Usage: create-roles.sh <database container name or prefix>}"
container="$(docker ps --filter "name=$prefix" --format '{{.Names}}' | head -n 1)"
[ -n "$container" ] || { echo "No running container matches $prefix" >&2; exit 1; }

ask_secret() {
  printf '%s: ' "$1" >&2
  stty -echo
  trap 'stty echo' EXIT INT TERM
  read -r answer
  stty echo
  printf '\n' >&2
  [ -n "$answer" ] || { echo "The password can't be empty" >&2; exit 1; }
  printf '%s' "$answer"
}

OWNER_DB_PASSWORD="$(ask_secret 'Password for financas_owner')"
APP_DB_PASSWORD="$(ask_secret 'Password for financas_app')"
export OWNER_DB_PASSWORD APP_DB_PASSWORD

docker exec -i -e OWNER_DB_PASSWORD -e APP_DB_PASSWORD "$container" sh -s \
  <"$(dirname "$0")/init/01-roles.sh"
echo "Roles financas_owner and financas_app created in $container"
