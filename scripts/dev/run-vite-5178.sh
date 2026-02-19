#!/bin/bash
# Hardened Vite launcher for localhost:5178
set -euo pipefail
cd "$(dirname "$0")/../.."

export VITE_DEV_PORT=5178
export VITE_HMR_PORT=5178
export CATN8_VITE_ORIGIN="${CATN8_VITE_ORIGIN:-http://localhost:5178}"

mkdir -p logs

PIDS=$(lsof -t -nP -iTCP:5178 -sTCP:LISTEN 2>/dev/null || true)
if [ -n "${PIDS}" ]; then
  echo "[run-vite-5178] Killing stale listeners: ${PIDS}"
  kill -9 ${PIDS} 2>/dev/null || true
fi

if [ ! -d node_modules ]; then
  echo "[run-vite-5178] Installing dependencies (including optional for esbuild)"
  npm ci --include=optional || npm install --include=optional
fi

printf '%s' "${CATN8_VITE_ORIGIN%/}" > hot

ORIG_NO_SCHEME="${CATN8_VITE_ORIGIN#*://}"
HOST_PART="${ORIG_NO_SCHEME%%:*}"
HOST_PART="${HOST_PART#[}"
HOST_PART="${HOST_PART%]}"
if [ -z "$HOST_PART" ]; then HOST_PART="localhost"; fi

echo "[run-vite-5178] Running npm run typecheck..."
npm run typecheck

echo "[run-vite-5178] Starting Vite on ${CATN8_VITE_ORIGIN} (host=${HOST_PART})"
exec npx vite --host "$HOST_PART" --port 5178 --strictPort --clearScreen false --debug
