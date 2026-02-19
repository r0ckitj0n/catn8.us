#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 /absolute/path/to/new-project [--name "Project Name"] [--install] [--init-git] [--force]

Creates a new project from templates/wf-starter/ with your WhimsicalFrog standards:
- Vite-managed assets
- PHP helpers (vite helper, logger, DB singleton, CSRF, secret store)
- CI guard scripts and basic lint configs

Options:
  --name "Project Name"  Friendly display name to inject (defaults to folder name)
  --install               Run npm install in the new project
  --init-git              Initialize a new Git repo in the new project
  --force                 Allow non-empty destination directory (use with caution)
USAGE
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" || $# -lt 1 ]]; then
  usage; exit 0
fi

DEST="$1"; shift || true
PROJECT_NAME=""
DO_INSTALL=0
INIT_GIT=0
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) PROJECT_NAME="${2:-}"; shift 2;;
    --install) DO_INSTALL=1; shift;;
    --init-git) INIT_GIT=1; shift;;
    --force) FORCE=1; shift;;
    *) echo "Unknown option: $1"; usage; exit 1;;
  esac
done

# Resolve repo root and template dir
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TPL_DIR="${REPO_ROOT}/templates/wf-starter"

if [[ ! -d "$TPL_DIR" ]]; then
  echo "Template directory not found: $TPL_DIR" >&2
  exit 1
fi

# Prepare destination
mkdir -p "$DEST"
if [[ -z "$PROJECT_NAME" ]]; then
  PROJECT_NAME="$(basename "$DEST")"
fi

# Check emptiness unless --force
if [[ $FORCE -eq 0 ]]; then
  if [[ -n "$(ls -A "$DEST" 2>/dev/null || true)" ]]; then
    echo "Destination is not empty: $DEST (use --force to override)" >&2
    exit 1
  fi
fi

# Copy template (including dotfiles)
rsync -a --human-readable --info=progress2 \
  --exclude 'node_modules' \
  --exclude 'dist' \
  "$TPL_DIR"/ "$DEST"/

# Token replacement: __PROJECT_NAME__
sed_inplace() {
  # Cross-platform in-place sed (BSD/macOS vs GNU)
  if sed --version >/dev/null 2>&1; then
    sed -i "" "$@" 2>/dev/null || sed -i "$@"
  else
    sed -i "" "$@" 2>/dev/null || sed -i "$@"
  fi
}

# Replace tokens in common text files
while IFS= read -r -d '' file; do
  if grep -q "__PROJECT_NAME__" "$file"; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s/__PROJECT_NAME__/${PROJECT_NAME//\//\/}/g" "$file"
    else
      sed -i "s/__PROJECT_NAME__/${PROJECT_NAME//\//\/}/g" "$file"
    fi
  fi
done < <(find "$DEST" -type f \( -name "*.php" -o -name "*.md" -o -name "*.json" -o -name "*.css" -o -name "*.js" -o -name "*.mjs" \) -print0)

# Copy Engineering Guidelines if present in parent repo
GUIDE_SRC="${REPO_ROOT}/documentation/WF_ENGINEERING_GUIDELINES.md"
if [[ -f "$GUIDE_SRC" ]]; then
  mkdir -p "$DEST/documentation"
  cp "$GUIDE_SRC" "$DEST/documentation/WF_ENGINEERING_GUIDELINES.md"
fi

# Optional: npm install
if [[ $DO_INSTALL -eq 1 ]]; then
  (cd "$DEST" && npm install)
fi

# Optional: git init
if [[ $INIT_GIT -eq 1 ]]; then
  (cd "$DEST" && git init && git add . && git commit -m "Initialize from WF starter")
fi

cat <<NEXT

✅ Project created at: $DEST
- Name: $PROJECT_NAME
- Template: $TPL_DIR

Next steps:
1) cd "$DEST"
2) cp .env.example .env  # and edit DB_*
3) ./scripts/start_servers.sh  # starts concurrent PHP + Vite servers

Open http://localhost:8080

Note: Use ./scripts/start_servers.sh instead of 'php -S' to ensure
concurrent request handling and prevent page freezing.
NEXT
