#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}" )" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

if [ ! -d .git ]; then
  echo "[install_git_hooks] Not a git repo (missing .git/)" >&2
  exit 1
fi

mkdir -p .git/hooks

if [ -f .githooks/pre-commit ]; then
  cp .githooks/pre-commit .git/hooks/pre-commit
  chmod +x .git/hooks/pre-commit
  echo "[install_git_hooks] Installed pre-commit hook" >&2
else
  echo "[install_git_hooks] Missing .githooks/pre-commit" >&2
  exit 1
fi
