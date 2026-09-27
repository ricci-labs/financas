#!/bin/sh
set -eu

if [ -n "${DATABASE_MIGRATION_URL:-}" ]; then
  node dist/ops/migrate.mjs
fi

exec env -u DATABASE_MIGRATION_URL node dist/main.mjs
