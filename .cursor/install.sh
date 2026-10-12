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
