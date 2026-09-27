#!/bin/sh
set -eu

prefix="${1:?Usage: change-password.sh <database container name or prefix> <role>}"
role="${2:?Usage: change-password.sh <database container name or prefix> <role>}"
case "$role" in
  financas_owner | financas_app) ;;
  *) echo "Only financas_owner and financas_app are changed here" >&2; exit 1 ;;
esac
container="$(docker ps --filter "name=$prefix" --format '{{.Names}}' | head -n 1)"
[ -n "$container" ] || { echo "No running container matches $prefix" >&2; exit 1; }

printf 'New password for %s: ' "$role" >&2
stty -echo
trap 'stty echo' EXIT INT TERM
read -r password
stty echo
printf '\n' >&2
case "$password" in
  '' | *[!0-9A-Za-z]*) echo "Use only letters and digits (e.g. openssl rand -hex 24)" >&2; exit 1 ;;
esac

printf "ALTER ROLE %s PASSWORD '%s';\n" "$role" "$password" |
  docker exec -i "$container" sh -c 'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
echo "Password of $role changed in $container. Update the app's environment in Dokploy and redeploy."
