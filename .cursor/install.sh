#!/usr/bin/env bash
# Idempotent repository bootstrap for catn8.us. Runs after the source is checked
# out and may run repeatedly, so every step must converge on repeated runs.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Local dev environment file. Defaults point at the local MariaDB started by
# .cursor/start.sh (root user, empty password, database "catn8").
if [ ! -f .env ]; then
    cp .env.example .env
fi

# PHP backend dependencies.
composer install --no-interaction --prefer-dist --no-progress

# Frontend dependencies (respects package-lock.json).
npm ci

# Type-check and produce a production-like dist bundle. `npm run build` runs the
# TypeScript type-check first, so a type error fails the install fast.
npm run build

# Best-effort: refresh local images from the live site so cloud/dev trees do not
# keep stale assets that could later overwrite newer production files on deploy.
# HTTP mode needs no deploy secrets; never fail bootstrap if live is unreachable.
if [[ "${CATN8_SKIP_SYNC_FROM_LIVE:-0}" != "1" ]]; then
  echo "Refreshing local images from live (best-effort HTTP)..."
  if ! bash scripts/sync_from_live.sh --images --refresh --http-only; then
    echo "Warning: sync-from-live skipped/failed; continuing install."
  fi
fi
