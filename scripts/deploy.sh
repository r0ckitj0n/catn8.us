#!/bin/bash

# Change to the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."

# Load local env (not committed) for deploy credentials/config.
ENV_FILE_LOCAL="$(pwd)/.env.local"
ENV_FILE="$(pwd)/.env"
if [[ -f "$ENV_FILE_LOCAL" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE_LOCAL"
  set +a
elif [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

# Load secrets from env or macOS Keychain.
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/secrets/env_or_keychain.sh"

usage() {
  cat <<'USAGE'
Usage: scripts/deploy.sh [--lite|--full|--dist-only|--env-only] [options]

Fast file deploy to LIVE via SFTP mirror + HTTP verification.

Required config (.env.local/.env or exported env):
  CATN8_DEPLOY_HOST
  CATN8_DEPLOY_USER

Required secret (env or macOS Keychain):
  CATN8_DEPLOY_PASS

Common options:
  --lite           Default mode (incremental deploy)
  --full           Full-replace mode
  --dist-only      Deploy dist assets only
  --env-only       Deploy .env.live only
  --backup-live    Trigger live website backup API before deploy
  --no-backup-live Skip live website backup API before deploy
  --purge          Purge managed remote directories before deploy
  --skip-build     Skip release build step
  --skip-typecheck Skip TypeScript check during build (sets CATN8_SKIP_TYPECHECK=1)
  --help           Show this help
USAGE
}

# Configuration (prefer environment variables for CI/secrets managers)
HOST="${CATN8_DEPLOY_HOST:-}"
USER="${CATN8_DEPLOY_USER:-}"
PASS="${CATN8_DEPLOY_PASS:-}"
REMOTE_PATH="/"
# Optional public base for sites under a subdirectory (e.g., /wf)
PUBLIC_BASE="${CATN8_PUBLIC_BASE:-}"
# Parameterized deployment base URL (protocol+host), fallback to catn8.us
DEPLOY_BASE_URL="${DEPLOY_BASE_URL:-https://catn8.us}"
BASE_URL="${DEPLOY_BASE_URL}${PUBLIC_BASE}"
CURL_CONNECT_TIMEOUT="${CATN8_CURL_CONNECT_TIMEOUT_SEC:-10}"
CURL_MAX_TIME="${CATN8_CURL_MAX_TIME_SEC:-45}"
LFTP_NET_TIMEOUT="${CATN8_LFTP_TIMEOUT_SEC:-30}"
LFTP_NET_MAX_RETRIES="${CATN8_LFTP_MAX_RETRIES:-1}"
LFTP_NET_SETTINGS=$'set net:timeout '"${LFTP_NET_TIMEOUT}"$'\nset net:max-retries '"${LFTP_NET_MAX_RETRIES}"$'\nset net:reconnect-interval-base 5\nset net:reconnect-interval-max 15'

require_var() {
  local key="$1" value="${!1:-}"
  if [[ -z "$value" ]]; then
    echo "Error: $key must be set (in environment or .env)." >&2
    exit 1
  fi
}

# Parameter parsing
MODE="lite"
SKIP_BUILD="${CATN8_SKIP_RELEASE_BUILD:-0}"
SKIP_TYPECHECK="${CATN8_SKIP_TYPECHECK:-0}"
PURGE="${CATN8_PURGE_REMOTE:-0}"
STRICT_VERIFY="${CATN8_STRICT_VERIFY:-0}"
UPLOAD_VENDOR="${CATN8_UPLOAD_VENDOR:-0}"
# Default safety: never delete anything under images/** on the remote.
PRESERVE_IMAGES=1
PURGE_IMAGES=0
CODE_ONLY=0
BACKUP_LIVE="${CATN8_BACKUP_BEFORE_DEPLOY:-0}"

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      usage
      exit 0
      ;;
    --code-only)
      CODE_ONLY=1
      shift
      ;;
    --preserve-images|--no-delete-images)
      PRESERVE_IMAGES=1
      shift
      ;;
    --purge-images)
      PURGE_IMAGES=1
      shift
      ;;
    --purge)
      PURGE=1
      shift
      ;;
    --backup-live)
      BACKUP_LIVE=1
      shift
      ;;
    --no-backup-live)
      BACKUP_LIVE=0
      shift
      ;;
    --full)
      MODE="full"
      export CATN8_FULL_REPLACE=1
      shift
      ;;
    --lite)
      MODE="lite"
      shift
      ;;
    --dist-only)
      MODE="dist-only"
      shift
      ;;
    --env-only)
      MODE="env-only"
      shift
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --skip-typecheck)
      SKIP_TYPECHECK=1
      shift
      ;;
    *)
      shift
      ;;
  esac
done

require_var CATN8_DEPLOY_HOST
require_var CATN8_DEPLOY_USER
catn8_secret_require CATN8_DEPLOY_PASS
PASS="${CATN8_DEPLOY_PASS}"

if [[ "$CODE_ONLY" == "1" && "$MODE" == "env-only" ]]; then
  echo "Error: --code-only cannot be combined with --env-only." >&2
  exit 2
fi
if [[ "$CODE_ONLY" == "1" && "$MODE" == "dist-only" ]]; then
  echo "Error: --code-only cannot be combined with --dist-only (use one or the other)." >&2
  exit 2
fi

if [ "$MODE" = "full" ]; then
  MIRROR_FLAGS="--reverse --delete --verbose --no-perms --overwrite --only-newer"
elif [ "$MODE" = "dist-only" ]; then
  # For dist-only, we usually want to ensure assets update even if size is same
  MIRROR_FLAGS="--reverse --delete --verbose --only-newer --no-perms"
else
  # Default fast mode: compare by size (ignore mtime) and only upload newer
  MIRROR_FLAGS="--reverse --delete --verbose --only-newer --ignore-time --no-perms"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

require_dist_artifacts() {
  if [ "$MODE" = "env-only" ]; then
    return 0
  fi

  if [ ! -s "dist/index.html" ]; then
    echo -e "${RED}❌ Missing dist/index.html. Refusing to deploy.${NC}"
    echo -e "${YELLOW}   Run: npm run build   (or: ./scripts/deploy.sh --skip-typecheck)${NC}"
    exit 1
  fi
  if [ ! -s "dist/.vite/manifest.json" ]; then
    echo -e "${RED}❌ Missing dist/.vite/manifest.json. Refusing to deploy.${NC}"
    echo -e "${YELLOW}   Run: npm run build   (or: ./scripts/deploy.sh --skip-typecheck)${NC}"
    exit 1
  fi
  if ! ls dist/assets/*.js >/dev/null 2>&1; then
    echo -e "${RED}❌ Missing dist/assets/*.js bundles. Refusing to deploy.${NC}"
    echo -e "${YELLOW}   Run: npm run build   (or: ./scripts/deploy.sh --skip-typecheck)${NC}"
    exit 1
  fi
}

# Ensure a fresh frontend build via the shared release orchestrator (build-only)
if [ "$SKIP_BUILD" != "1" ] && [ "$MODE" != "env-only" ]; then
  if [ "$SKIP_TYPECHECK" = "1" ]; then
    export CATN8_SKIP_TYPECHECK=1
  fi
  echo -e "${GREEN}🏗  Running release.sh build (no deploy)...${NC}"
  bash scripts/release.sh --no-deploy
fi

echo -e "${GREEN}🚀 Starting fast file deployment...${NC}"
if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
  echo -e "${YELLOW}DRY-RUN: Skipping live website backup API call${NC}"
elif [ "$BACKUP_LIVE" != "1" ]; then
  echo -e "${YELLOW}⏭️  Skipping website backup API (set CATN8_BACKUP_BEFORE_DEPLOY=1 or pass --backup-live to enable)${NC}"
else
  echo -e "${GREEN}💾 Backing up website...${NC}"
  BACKUP_URL="${BASE_URL}/api/backup_website.php"
  BACKUP_TOKEN="${CATN8_ADMIN_TOKEN:-${CATN8_DEPLOY_ADMIN_TOKEN:-}}"
  if [ -n "$BACKUP_TOKEN" ]; then
    if curl -fsS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" -X POST "${BACKUP_URL}?admin_token=${BACKUP_TOKEN}" >/dev/null; then
      echo -e "${GREEN}✅ Website backup API triggered${NC}"
    else
      echo -e "${YELLOW}⚠️  Website backup failed (auth/token or endpoint issue), continuing deployment...${NC}"
    fi
  else
    echo -e "${YELLOW}⏭️  Skipping website backup API (set CATN8_ADMIN_TOKEN or CATN8_DEPLOY_ADMIN_TOKEN to enable)${NC}"
  fi
fi
echo -e "${YELLOW}⏭️  Skipping database updates in fast deploy (use deploy_full.sh for DB restore)${NC}"

# Quarantine duplicate/backup files before build/upload
echo -e "${GREEN}🧹 Quarantining duplicate/backup files...${NC}"
bash scripts/dev/quarantine_duplicates.sh || true

# Clean up any stale git lock file
if [ -f .git/index.lock ]; then
  echo -e "${YELLOW}⚠️  Removing stale .git/index.lock file...${NC}"
  rm -f .git/index.lock
fi

# Remote VCS integration removed: skipping any repo sync/push steps
echo -e "${GREEN}🔄 Skipping repository sync (remote VCS disabled)${NC}"

# Prune old hashed JS bundles locally so remote stale files are removed via --delete
echo -e "${GREEN}🧹 Pruning old hashed bundles in local dist...${NC}"
prune_stems=(
  "assets/js/app.js"
  "assets/js/header-bootstrap.js"
  "assets/login-modal"
  "assets/login-page"
)
for stem in "${prune_stems[@]}"; do
  dir="dist/$(dirname "$stem")"
  base="$(basename "$stem")"
  if [ -d "$dir" ]; then
    matches=("$dir/${base}-"*.js)
    # If glob doesn't match, it returns the pattern itself; guard that
    if [ -e "${matches[0]}" ]; then
      # Sort by mtime descending, keep first (newest)
      newest=$(ls -t $dir/${base}-*.js 2>/dev/null | head -n 1)
      for f in $dir/${base}-*.js; do
        if [ "$f" != "$newest" ]; then
          echo "Removing old bundle: $f"
          rm -f "$f"
        fi
      done
    fi
  fi
done

# Pre-clean common duplicate/backup/tmp files on the remote to avoid slow deletes during mirror
echo -e "${GREEN}🧽 Pre-cleaning duplicate/backup/tmp files on server...${NC}"
if [ "$PRESERVE_IMAGES" = "1" ]; then
  PRECLEAN_IMAGE_LINES=""
else
  PRECLEAN_IMAGE_LINES=$'cd images\nrm -f .tmp* ".tmp2 *" *.bak *.bak.*\ncd items\nrm -f .tmp* ".tmp2 *" *.bak *.bak.*\ncd /\n'
fi
cat > preclean_remote.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit no
${LFTP_NET_SETTINGS}
open sftp://$USER:$PASS@$HOST
rm -f .tmp* ".tmp2 *" *.bak *.bak.*
rm -f src/.tmp* src/".tmp2 *" src/*.bak src/*.bak.*
${PRECLEAN_IMAGE_LINES}
bye
EOL

if [ "$MODE" != "env-only" ]; then
  if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
    echo -e "${YELLOW}DRY-RUN: Skipping lftp pre-clean step${NC}"
    rm -f preclean_remote.txt
  else
    lftp -f preclean_remote.txt || true
    rm -f preclean_remote.txt
  fi
fi

# Optional: Purge remote directories before deployment
if [ "$PURGE" = "1" ]; then
  echo -e "${RED}🔥 Purging managed directories on LIVE server...${NC}"
  if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
    echo -e "${YELLOW}DRY-RUN: Skipping remote purge${NC}"
  else
    PURGE_IMAGE_DIRS=""
    if [ "$PURGE_IMAGES" = "1" ]; then
      PURGE_IMAGE_DIRS=" images"
    fi
    cat > purge_remote.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit no
${LFTP_NET_SETTINGS}
open sftp://$USER:$PASS@$HOST
rm -r api dist${PURGE_IMAGE_DIRS} includes scripts src documentation Documentation vendor node_modules || true
rm index.php .htaccess index.html favicon.ico manifest.json package.json package-lock.json || true
bye
EOL
    lftp -f purge_remote.txt || echo -e "${YELLOW}⚠️ Purge had some issues (likely missing dirs), continuing...${NC}"
    rm purge_remote.txt
  fi
fi

# Quarantine any new duplicate files created during build
if [ "$MODE" != "env-only" ]; then
  echo -e "${GREEN}🧹 Quarantining any duplicate files created during build...${NC}"
  bash scripts/dev/quarantine_duplicates.sh || true

  if [ -x "./scripts/write_version_metadata.sh" ]; then
    echo -e "${GREEN}🧾 Updating deploy version metadata...${NC}"
    ./scripts/write_version_metadata.sh --deployed
  fi
fi

# Never deploy if required build artifacts are missing.
require_dist_artifacts

# Image handling:
# - Default: deploy images with the normal mirror flow.
# - Preserve mode: do not upload/delete/touch any images/** paths on the server.
if [ "$PRESERVE_IMAGES" = "1" ]; then
  IMAGE_EXCLUDE_LINES=$'  --exclude-glob "images/**" \\'
else
  IMAGE_EXCLUDE_LINES=""
fi

# Create lftp commands for file deployment
echo -e "${GREEN}📁 Preparing file deployment...${NC}"
DOC_HTACCESS_INCLUDE=""
if [ -f documentation/.htaccess ]; then
  DOC_HTACCESS_INCLUDE=' --include-glob documentation/.htaccess'
fi
cat > deploy_commands.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
${LFTP_NET_SETTINGS}
# Log sessions to logs/lftp_deploy.log (appends by default)
debug 3 -o logs/lftp_deploy.log
open sftp://$USER:$PASS@$HOST
# Note: SFTP lacks checksums. In full-replace mode we use --overwrite to force upload.
# In fast mode, we use size-only + only-newer to avoid re-uploading identical files.
mirror $MIRROR_FLAGS \
  --exclude-glob .git/ \
  --exclude-glob .git \
  --exclude-glob node_modules/ \
  --exclude-glob vendor/** \
  --exclude-glob .local/ \
  --exclude-glob .cache/ \
  --exclude-glob .agent/ \
  --exclude-glob .vscode/ \
  --exclude-glob .DS_Store \
  --exclude-glob hot \
  --exclude-glob "**/.DS_Store" \
  --exclude-glob "sessions/**" \
  --exclude-glob .env \
  --exclude-glob ".env.*" \
  --exclude-glob "backups/**" \
  --exclude-glob "logs/**" \
  --exclude-glob "reports/**" \
  --exclude-glob reports/ \
  --exclude-glob "dist/**" \
  --exclude-glob "src/**"${DOC_HTACCESS_INCLUDE} \
  --exclude-glob "*.log" \
  --exclude-glob "**/*.log" \
  --exclude-glob "**/*.sh" \
  --exclude-glob "**/*.plist" \
  --exclude-glob temp_cron.txt \
  --exclude-glob SERVER_MANAGEMENT.md \
  --exclude-glob factory-tutorial/ \
  --exclude-glob index.html \
  --exclude-glob backup.sql \
  --exclude-glob backup_*.tar.gz \
  --exclude-glob *_backup_*.tar.gz \
  --exclude-glob .tmp* \
  --exclude-glob ".tmp2 *" \
  --exclude-glob deploy_commands.txt \
  --exclude-glob fix_clown_frog_image.sql \
${IMAGE_EXCLUDE_LINES}
  --exclude-glob config/my.cnf \
  --exclude-glob config/secret.key \
  --exclude-glob "* [0-9].*" \
  --exclude-glob "* [0-9]/*" \
  --exclude-glob "* copy*" \
  --include-glob credentials.json \
  . $REMOTE_PATH
bye
EOL

# Ensure dev-mode is disabled on production
export CATN8_VITE_DISABLE_DEV=1
export CATN8_VITE_MODE=prod

# Run lftp with the commands
DRY_DEPLOY_SUCCESS=1
if [ "$MODE" != "env-only" ] && [ "$MODE" != "dist-only" ]; then
  echo -e "${GREEN}🌐 Deploying files to server...${NC}"
  if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
    echo -e "${YELLOW}DRY-RUN: Skipping lftp mirror (file deployment)${NC}"
    DRY_DEPLOY_SUCCESS=1
  else
    # Create logs directory if it doesn't exist
    mkdir -p logs
    if lftp -f deploy_commands.txt; then
      DRY_DEPLOY_SUCCESS=1
    else
      DRY_DEPLOY_SUCCESS=0
    fi
  fi
fi
if [ "${DRY_DEPLOY_SUCCESS}" = "1" ]; then
  echo -e "${GREEN}✅ Files deployed successfully${NC}"
  # Safety fallback: publish built dist/index.html at web root as index.html.
  # This avoids exposing the source root index.html (/src/*) and provides a fallback
  # when host rewrite rules are bypassed or temporarily inconsistent.
  if [ "$MODE" != "env-only" ]; then
    echo -e "${GREEN}🧷 Publishing built index fallback (dist/index.html -> /index.html)...${NC}"
    cat > upload_root_index.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
${LFTP_NET_SETTINGS}
open sftp://$USER:$PASS@$HOST
put dist/index.html -o index.html
bye
EOL
    if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
      echo -e "${YELLOW}DRY-RUN: Skipping root index fallback upload${NC}"
    elif lftp -f upload_root_index.txt; then
      echo -e "${GREEN}✅ Root index fallback uploaded${NC}"
    else
      echo -e "${RED}❌ Root index fallback upload failed.${NC}"
      rm -f upload_root_index.txt
      exit 1
    fi
    rm -f upload_root_index.txt
  fi
  # Optional: upload Composer vendor tree (off by default to keep deploys lean).
  if [ "$MODE" != "env-only" ] && [ "${UPLOAD_VENDOR}" = "1" ]; then
    echo -e "${GREEN}📦 Uploading vendor/ (CATN8_UPLOAD_VENDOR=1)...${NC}"
    cat > deploy_vendor.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
${LFTP_NET_SETTINGS}
open sftp://$USER:$PASS@$HOST
mirror --reverse --delete --verbose --only-newer --no-perms \
  vendor vendor
bye
EOL
    if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
      echo -e "${YELLOW}DRY-RUN: Skipping vendor sync${NC}"
    elif lftp -f deploy_vendor.txt; then
      echo -e "${GREEN}✅ Vendor synced${NC}"
    else
      echo -e "${YELLOW}⚠️  Vendor sync failed; continuing${NC}"
    fi
    rm -f deploy_vendor.txt
  else
    echo -e "${YELLOW}⏭️  Skipping vendor sync (set CATN8_UPLOAD_VENDOR=1 to enable)${NC}"
  fi
  # Optional: Upload maintenance utility (disabled by default to avoid mkdir errors on some hosts)
  if [ "${CATN8_UPLOAD_MAINTENANCE:-0}" = "1" ]; then
    echo -e "${GREEN}🧰 Uploading maintenance utilities (prune_sessions.sh)...${NC}"
    cat > upload_maintenance.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
${LFTP_NET_SETTINGS}
open sftp://$USER:$PASS@$HOST
mkdir -p api/maintenance
cd api/maintenance
put scripts/maintenance/prune_sessions.sh -o prune_sessions.sh
chmod 755 prune_sessions.sh
bye
EOL
    if lftp -f upload_maintenance.txt; then
      echo -e "${GREEN}✅ Maintenance script uploaded to /api/maintenance/prune_sessions.sh${NC}"
    else
      echo -e "${YELLOW}⚠️  Skipping maintenance upload (remote may not allow creating api/maintenance)${NC}"
    fi
    rm -f upload_maintenance.txt
  else
    echo -e "${YELLOW}⏭️  Skipping maintenance upload (set CATN8_UPLOAD_MAINTENANCE=1 to enable)${NC}"
  fi
  # Optional: Upload live environment file (.env.live -> .env) when requested
  if [ -f ".env.live" ] && ([ "${CATN8_UPLOAD_LIVE_ENV:-0}" = "1" ] || [ "$MODE" = "env-only" ]); then
    echo -e "${GREEN}🔐 Uploading live environment file (.env.live -> .env)...${NC}"
    cat > upload_env.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit no
${LFTP_NET_SETTINGS}
open sftp://$USER:$PASS@$HOST
# Backup existing .env if present
mv .env .env.bak || true
set cmd:fail-exit yes
put .env.live -o .env
chmod 600 .env
bye
EOL
    if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
      echo -e "${YELLOW}DRY-RUN: Skipping .env upload${NC}"
    elif lftp -f upload_env.txt; then
      echo -e "${GREEN}✅ Live .env updated from .env.live${NC}"
    else
      echo -e "${YELLOW}⚠️  Failed to upload .env.live; continuing without updating live env${NC}"
    fi
  rm -f upload_env.txt
  else
    echo -e "${YELLOW}⏭️  Skipping live .env upload (missing .env.live or CATN8_UPLOAD_LIVE_ENV!=1)${NC}"
  fi
  # Always perform a dedicated dist sync.
  # Rationale: primary mirror excludes dist/**, so this pass is required in all modes,
  # including --full (CATN8_FULL_REPLACE=1), to publish the latest frontend bundles.
  echo -e "${GREEN}📦 Ensuring dist assets & manifest are updated...${NC}"
  cat > deploy_dist.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
${LFTP_NET_SETTINGS}
open sftp://$USER:$PASS@$HOST
mirror --reverse --delete --verbose --overwrite --no-perms \
  dist dist
bye
EOL
  if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
    echo -e "${YELLOW}DRY-RUN: Skipping dist sync${NC}"
  elif lftp -f deploy_dist.txt; then
    echo -e "${GREEN}✅ Dist assets & manifest synced${NC}"
  else
    echo -e "${RED}❌ Dist sync failed.${NC}"
    rm -f deploy_dist.txt
    exit 1
  fi
  rm -f deploy_dist.txt

  # Secondary passes are unnecessary in full-replace mode
  if [ "${CATN8_FULL_REPLACE:-0}" != "1" ]; then
    if [ "$MODE" != "dist-only" ]; then
      # Perform a dedicated sync for includes subdirectories
      # Rationale: PHP include subdirectories like item_sizes/, traits/, helpers/, etc.
      # contain critical dependencies that may be new (never on server) and need force upload.
      # The main mirror may skip them due to --ignore-time comparisons.
      echo -e "${GREEN}📁 Ensuring includes subdirectories are synced...${NC}"
      cat > deploy_includes.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
${LFTP_NET_SETTINGS}
open sftp://$USER:$PASS@$HOST
mirror --reverse --verbose --only-newer --no-perms \
  includes includes
bye
EOL
      if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
        echo -e "${YELLOW}DRY-RUN: Skipping includes sync${NC}"
      elif lftp -f deploy_includes.txt; then
        echo -e "${GREEN}✅ Includes synced${NC}"
      else
        echo -e "${YELLOW}⚠️  Backend includes sync failed; continuing${NC}"
      fi
      rm -f deploy_includes.txt
    fi
  fi
else
  echo -e "${RED}❌ File deployment failed${NC}"
  rm deploy_commands.txt
  exit 1
fi

# Clean up lftp commands file
rm deploy_commands.txt

# Ensure no Vite hot file exists on the live server (prevents accidental dev mode)
if [ "$MODE" != "env-only" ]; then
  echo -e "${GREEN}🧹 Enforcing production mode on server (remove dev artifacts)...${NC}"
  ARCHIVE_TS="$(date '+%Y%m%d-%H%M%S')"
  VENDOR_PRUNE_CMD="rm -r vendor || true"
  if [ "${UPLOAD_VENDOR}" = "1" ]; then
    VENDOR_PRUNE_CMD=":"
  fi
  cat > enforce_prod_marker.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
${LFTP_NET_SETTINGS}
open sftp://$USER:$PASS@$HOST
lcd .
put /dev/null -o .disable-vite-dev
bye
EOL
  if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
    echo -e "${YELLOW}DRY-RUN: Skipping production marker upload (.disable-vite-dev)${NC}"
  else
    lftp -f enforce_prod_marker.txt > /dev/null 2>&1 || true
  fi
  rm -f enforce_prod_marker.txt

  cat > cleanup_prod.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit no
${LFTP_NET_SETTINGS}
open sftp://$USER:$PASS@$HOST
mkdir -p backups
mkdir -p backups/src-archives
mv src backups/src-archives/src-${ARCHIVE_TS}
rm -f hot
rm -r node_modules || true
${VENDOR_PRUNE_CMD}
rm -f dist/.htaccess
bye
EOL

  if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
    echo -e "${YELLOW}DRY-RUN: Skipping remote cleanup (hot/index.html/src/dist/.htaccess)${NC}"
  else
    lftp -f cleanup_prod.txt > /dev/null 2>&1 || true
  fi
  rm cleanup_prod.txt
fi

# Verify deployment (HTTP-based, avoids dotfile visibility issues)
if [ "$MODE" != "env-only" ]; then
  echo -e "${GREEN}🔍 Verifying deployment over HTTP...${NC}"
  VERIFY_FAILED=0
  
  # Check Vite manifest availability (prefer .vite/manifest.json)
  HTTP_MANIFEST_CODE=$(curl -sS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" -o /dev/null -w "%{http_code}" "$BASE_URL/dist/.vite/manifest.json")
  if [ "$HTTP_MANIFEST_CODE" != "200" ]; then
    HTTP_MANIFEST_CODE=$(curl -sS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" -o /dev/null -w "%{http_code}" "$BASE_URL/dist/manifest.json")
  fi
  if [ "$HTTP_MANIFEST_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Vite manifest accessible over HTTP${NC}"
  else
    echo -e "${YELLOW}⚠️  Vite manifest not accessible over HTTP (code $HTTP_MANIFEST_CODE)${NC}"
    VERIFY_FAILED=1
  fi
  
  # Homepage should never reference source paths in production.
  HOME_HTML=$(curl -sS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" "$BASE_URL/")
  if echo "$HOME_HTML" | grep -q "/src/"; then
    echo -e "${YELLOW}⚠️  Homepage still references /src/ paths${NC}"
    VERIFY_FAILED=1
  else
    echo -e "${GREEN}✅ Homepage has no /src/ references${NC}"
  fi

  # Extract one JS and one CSS asset from homepage HTML and verify when present.
  # Some pages load assets dynamically from Vite manifest, so missing static tags is not fatal.
  APP_JS=$(echo "$HOME_HTML" | grep -Eo "/(dist/assets|build-assets)/[^\"']+\\.js" | head -n1 || true)
  MAIN_CSS=$(echo "$HOME_HTML" | grep -Eo "/(dist/assets|build-assets)/[^\"']*public-core[^\"']+\\.css" | head -n1 || true)
  if [ -n "$APP_JS" ]; then
    CODE_JS=$(curl -sS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" -o /dev/null -w "%{http_code}" "$BASE_URL$APP_JS")
    echo -e "  • JS $APP_JS -> HTTP $CODE_JS"
    if [ "$CODE_JS" != "200" ]; then VERIFY_FAILED=1; fi
  else
    echo -e "  • JS: ℹ️ Not found in homepage HTML (manifest loader may be in use)"
  fi
  if [ -n "$MAIN_CSS" ]; then
    CODE_CSS=$(curl -sS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" -o /dev/null -w "%{http_code}" "$BASE_URL$MAIN_CSS")
    echo -e "  • CSS $MAIN_CSS -> HTTP $CODE_CSS"
    if [ "$CODE_CSS" != "200" ]; then VERIFY_FAILED=1; fi
  else
    echo -e "  • CSS: ℹ️ Not found in homepage HTML (manifest loader may be in use)"
  fi
  
  # Fix permissions automatically after deployment
  echo -e "${GREEN}🔧 Fixing image permissions on server...${NC}"
  # Do not delete anything under images/** (you have an admin cleanup button for stale images).
  cat > fix_permissions.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
${LFTP_NET_SETTINGS}
open sftp://$USER:$PASS@$HOST
chmod 755 images/
bye
EOL

  if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
    echo -e "${YELLOW}DRY-RUN: Skipping remote permissions fix${NC}"
  else
    lftp -f fix_permissions.txt > /dev/null 2>&1 || true
  fi
  rm fix_permissions.txt
  
  if [ "${STRICT_VERIFY}" = "1" ] && [ "$VERIFY_FAILED" != "0" ]; then
    echo -e "${RED}❌ Strict verification failed. Deployment is not healthy.${NC}"
    exit 1
  fi
fi

# Test image accessibility (use a stable asset; path can be overridden)
echo -e "${GREEN}🌍 Testing image accessibility...${NC}"
TEST_LOGO_PATH="${BRAND_LOGO_PATH:-/images/logos/logo-catn8.webp}"
# If TEST_LOGO_PATH is absolute (starts with http), use as-is; otherwise prefix with BASE_URL
if [[ "$TEST_LOGO_PATH" =~ ^https?:// ]]; then
  TEST_LOGO_URL="$TEST_LOGO_PATH"
else
  # ensure leading slash
  case "$TEST_LOGO_PATH" in
    /*) TEST_LOGO_URL="${BASE_URL}${TEST_LOGO_PATH}" ;;
    *)  TEST_LOGO_URL="${BASE_URL}/$TEST_LOGO_PATH" ;;
  esac
fi
HTTP_CODE=$(curl -sS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" -o /dev/null -w "%{http_code}" "$TEST_LOGO_URL")
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Logo image is accessible online!${NC}"
elif [ "$HTTP_CODE" = "404" ]; then
  echo -e "${YELLOW}⚠️  Logo image returns 404 - may need a few minutes to propagate${NC}"
else
  echo -e "${YELLOW}⚠️  Logo image returned HTTP code: $HTTP_CODE${NC}"
fi

# Final summary
echo -e "\n${GREEN}📊 Fast Deployment Summary:${NC}"
echo -e "  • Files: ✅ Deployed to server"
echo -e "  • Database: ⏭️  Skipped (use deploy_full.sh for database updates)"
if [ "$PRESERVE_IMAGES" = "1" ]; then
  echo -e "  • Images: ✅ Synced (no deletes under images/**)"
else
  echo -e "  • Images: ✅ Included in deployment"
fi
[ "$PURGE" = "1" ] && echo -e "  • Remote Purge: 🔥 Performed (managed directories)"
echo -e "  • Verification: ✅ Completed"

echo -e "\n${GREEN}🎉 Fast deployment completed!${NC}"
echo -e "${YELLOW}💡 Use ./deploy_full.sh when you need to update the database${NC}"
