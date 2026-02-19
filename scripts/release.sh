#!/usr/bin/env bash
# WhimsicalFrog release orchestrator
#
# Purpose: One command to build and deploy to live.
#
# Usage examples:
#   scripts/release.sh --message "feat: update room modal"              # build (prod) and deploy
#   scripts/release.sh --no-deploy --message "chore: build only"         # skip deploy
#   scripts/release.sh --repo <remote-url-or-slug>                        # (unused) repository URL or slug
#   scripts/release.sh --branch main --remote origin                      # (unused) customize branch/remote
#   scripts/release.sh --dry-run                                          # print steps without executing
#   scripts/release.sh --prod --scan-secrets                              # pass through to build.sh
#
# Flags:
#   --no-build        Skip build.sh
#   --no-push         Skip repository push (not used)
#   --no-deploy       Skip deploy
#   --message MSG     Commit message (default: chore: release)
#   --repo URL|slug   Repository URL or slug (owner/name) [not used]
#   --branch NAME     Branch to push (default: main)
#   --remote NAME     Remote name (default: origin)
#   --dry-run         Show what would run without executing
#   --ci, --prod, --scan-secrets, --skip-node, --skip-php, --verbose  # forwarded to build.sh (note: --prod is default)
#
set -euo pipefail
IFS=$'\n\t'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Defaults
DO_BUILD=true
DO_PUSH=true
DO_DEPLOY=true
DO_TAG=true
DO_GH_RELEASE=true
TAG_PREFIX="deploy"
COMMIT_MESSAGE="chore: release $(date '+%Y-%m-%d %H:%M:%S %Z')"
REPO=""
BRANCH="main"
REMOTE="origin"
DRY_RUN=false

# Build flags passthrough (default to --prod)
BUILD_ARGS=("--prod")

# Arg parsing
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-build) DO_BUILD=false; shift ;;
    --no-push) DO_PUSH=false; shift ;;
    --no-deploy) DO_DEPLOY=false; shift ;;
    --no-tag) DO_TAG=false; shift ;;
    --no-gh-release) DO_GH_RELEASE=false; shift ;;
    --tag-prefix) TAG_PREFIX="${2:-$TAG_PREFIX}"; shift 2 ;;
    --message) COMMIT_MESSAGE="${2:-$COMMIT_MESSAGE}"; shift 2 ;;
    --repo) REPO="${2:-}"; shift 2 ;;
    --branch) BRANCH="${2:-$BRANCH}"; shift 2 ;;
    --remote) REMOTE="${2:-$REMOTE}"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --ci|--prod|--scan-secrets|--skip-node|--skip-php|--verbose)
      BUILD_ARGS+=("$1"); shift ;;
    -h|--help)
      grep -E "^#( |$)" "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

run() {
  if [ "$DRY_RUN" = true ]; then
    echo "+ $*"
  else
    eval "$@"
  fi
}

section() {
  echo -e "\n============================================================"
  echo -e "== $*"
  echo -e "============================================================\n"
}

# 1) Build
if [ "$DO_BUILD" = true ]; then
  section "Build: running ./scripts/npmrunbuild.sh ${BUILD_ARGS[*]:-}"
  if [ ! -x "$ROOT_DIR/scripts/npmrunbuild.sh" ]; then
    echo "ERROR: scripts/npmrunbuild.sh not found or not executable at repo root" >&2
    exit 1
  fi
  if [ "$DRY_RUN" = true ]; then
    echo "+ "$ROOT_DIR"/scripts/npmrunbuild.sh ${BUILD_ARGS[*]:-}"
  else
    "$ROOT_DIR"/scripts/npmrunbuild.sh ${BUILD_ARGS[*]:-}
  fi
else
  section "Build: skipped (--no-build)"
fi

# 2) Remote VCS integration removed — no push/tag/release
section "Git: skipped (remote VCS disabled)"

# 3) Deploy to live (delegated to individual deploy scripts; no deploy is run here)
section "Deploy: skipped in release.sh (run scripts/deploy*.sh separately)"

section "All done"
echo "Release flow completed."
