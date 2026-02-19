#!/bin/bash
set -euo pipefail

# scripts/dev.sh - Start catn8.us in DEV mode (PHP + Vite with HMR)
# Usage: ./scripts/dev.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

PORT=${PORT:-8888}
VITE_PORT=${VITE_DEV_PORT:-5178}

mkdir -p logs

# Sync .windsurfrules from windsurfrules.md (same behavior as go.sh)
if [ -f "windsurfrules.md" ]; then
  mkdir -p backups
  if [ -f ".windsurfrules" ]; then
    ts="$(date +%Y%m%d%H%M%S)"
    mv ".windsurfrules" "backups/.windsurfrules.${ts}.bak"
  fi
  cp "windsurfrules.md" ".windsurfrules"
fi

# Enable dev mode: remove flag and unset env disable
rm -f .disable-vite-dev || true
unset CATN8_VITE_DISABLE_DEV || true

# Provide dev origin to proxy
: "${CATN8_VITE_ORIGIN:=http://localhost:${VITE_PORT}}"
export CATN8_VITE_ORIGIN

echo "$CATN8_VITE_ORIGIN" > hot

# Clear caches (same behavior as go.sh)
./scripts/clear_caches.sh

# Rebuild dist so production-like output stays fresh even while using HMR
rm -rf dist
npm run typecheck
npm run build

echo "DEV MODE"
echo "  PHP:  http://localhost:${PORT}"
echo "  Vite: ${CATN8_VITE_ORIGIN}"

# Restart both servers (PHP + Vite)
./scripts/restart_servers.sh
