#!/bin/bash
set -euo pipefail

# scripts/npmrunbuild.sh - Cleans Vite build artifacts and runs `npm run build`
# Usage: ./scripts/npmrunbuild.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}" )" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PROJECT_NAME="catn8.us"
MANIFEST_PATH="dist/.vite/manifest.json"
DIST_DIR="dist"

if [ ! -f "package.json" ]; then
  echo "[npmrunbuild] Error: package.json not found in $PROJECT_ROOT" >&2
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "[npmrunbuild] Error: node_modules missing. Run npm install before building." >&2
  exit 1
fi

echo "[npmrunbuild] Cleaning previous Vite artifacts for $PROJECT_NAME..."
if [ -f "$MANIFEST_PATH" ]; then
  rm -f "$MANIFEST_PATH"
  echo "  - Removed $MANIFEST_PATH"
else
  echo "  - Manifest file not found (already clean)"
fi

if [ -d "$DIST_DIR" ]; then
  rm -rf "$DIST_DIR"
  echo "  - Removed $DIST_DIR directory"
else
  echo "  - dist directory not found (already clean)"
fi

mkdir -p "$DIST_DIR"

echo "[npmrunbuild] Running npm run typecheck and build from $PROJECT_ROOT..."
npm run typecheck
npm run build

echo "[npmrunbuild] Build completed successfully."
