#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

log() {
  printf '[devmode.sh] %s\n' "$1"
}

log 'Re-enabling Vite dev mode (creating hot file, removing .disable-vite-dev)...'
# Default Vite dev origin matches other dev scripts (5178)
: "${VITE_DEV_PORT:=5178}"
: "${CATN8_VITE_ORIGIN:=http://localhost:${VITE_DEV_PORT}}"
printf '%s\n' "${CATN8_VITE_ORIGIN%/}" > hot
rm -f .disable-vite-dev

log 'Dev mode is now enabled. Start the Vite dev server (npm run dev) if it is not already running.'
