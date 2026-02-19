#!/bin/bash
set -euo pipefail

# scripts/prod.sh - Run WhimsicalFrog in PROD mode (PHP only, built assets)
# Usage: ./scripts/prod.sh [--deploy|--live] [--no-deploy]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

PORT=${PORT:-8888}

export PORT

mkdir -p logs

log() {
  printf '[prod.sh] %s\n' "$1"
}

usage() {
  cat <<'EOT'
Usage: scripts/prod.sh [--deploy|--live] [--no-deploy]

Defaults to local-only mode (no live deployment). Pass --deploy or --live to
upload dist/ via scripts/deploy_dist.sh. Explicit --no-deploy forces local mode
even if CATN8_GO_DEPLOY=1 is exported.
EOT
}

DO_DEPLOY=${CATN8_GO_DEPLOY:-0}
while (($#)); do
  case "$1" in
    --deploy|--live)
      DO_DEPLOY=1
      ;;
    --no-deploy)
      DO_DEPLOY=0
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[prod.sh] Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [ -f "windsurfrules.md" ]; then
  mkdir -p backups
  if [ -f ".windsurfrules" ]; then
    ts="$(date +%Y%m%d%H%M%S)"
    mv ".windsurfrules" "backups/.windsurfrules.${ts}.bak"
  fi
  cp "windsurfrules.md" ".windsurfrules"
  log 'Synced .windsurfrules from windsurfrules.md'
else
  log 'windsurfrules.md not found; skipping .windsurfrules sync'
fi

log 'Disabling Vite dev mode (removing hot file, setting .disable-vite-dev)...'
rm -f hot
touch .disable-vite-dev
export CATN8_VITE_DISABLE_DEV=1

log 'Clearing caches...'
./scripts/clear_caches.sh

# Ensure node deps then build assets
if [ ! -d "node_modules" ]; then
  echo "Installing npm dependencies..."
  npm install --silent
fi

log 'Removing previous dist output...'
rm -rf dist

log 'Running npm run typecheck and build...'
npm run typecheck
npm run build

if [ "$DO_DEPLOY" = "1" ]; then
  log 'Running scripts/deploy_dist.sh (live deploy requested)...'
  ./scripts/deploy_dist.sh
else
  log 'Skipping scripts/deploy_dist.sh (local test mode). Use --deploy to send dist/ to live.'
fi

log 'Restarting servers in PROD mode (PHP only)...'
./scripts/restart_servers.sh

# Check if server is running
if lsof -ti tcp:"$PORT" > /dev/null 2>&1; then
  PHP_PID=$(lsof -ti tcp:"$PORT")
  echo "🐸 PROD MODE"
  echo "  PHP:  http://localhost:${PORT} (PID $PHP_PID)"
  echo "  Vite: disabled"
  echo "  Server: Concurrent (Python + php-cgi)"
  echo "Logs: logs/php_server.log"
else
  echo "❌ Failed to start PHP server (see logs/php_server.log)"
  exit 1
fi
