#!/bin/bash

# Change to the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."

source "${SCRIPT_DIR}/secrets/env_or_keychain.sh"

usage() {
  cat <<'USAGE'
Usage: scripts/deploy.sh

Fast file deploy to LIVE via SFTP mirror + basic HTTP verification.

Required config (in .env/.env.local or exported env):
  CATN8_DEPLOY_HOST
  CATN8_DEPLOY_USER

Required secret (env or macOS Keychain via scripts/secrets/env_or_keychain.sh):
  CATN8_DEPLOY_PASS

Common options (env vars):
  CATN8_DRY_RUN=1            Skip any mutating remote actions
  CATN8_SKIP_RELEASE_BUILD=1 Skip scripts/release.sh build step
  CATN8_FULL_REPLACE=1       Force overwrite uploads (slower but safer for full refresh)
  CATN8_UPLOAD_LIVE_ENV=1    If .env.live exists, upload it to live as .env
  CATN8_PUBLIC_BASE=/subdir  If site is deployed under a subdirectory
  DEPLOY_BASE_URL=https://.. Base URL used for HTTP verification (default https://catn8.us)
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

 # Load .env.local if present, else .env
 ENV_FILE_LOCAL="${SCRIPT_DIR}/../.env.local"
 ENV_FILE="${SCRIPT_DIR}/../.env"
 if [[ -f "${ENV_FILE_LOCAL}" ]]; then
   set -a
   # shellcheck disable=SC1090
   . "${ENV_FILE_LOCAL}"
   set +a
 elif [[ -f "${ENV_FILE}" ]]; then
   set -a
   # shellcheck disable=SC1090
   . "${ENV_FILE}"
   set +a
 fi

# Configuration
if [[ -z "${CATN8_DEPLOY_HOST:-}" ]]; then
  echo "[deploy.sh] Error: CATN8_DEPLOY_HOST must be set (in .env/.env.local or exported env)" >&2
  exit 1
fi
if [[ -z "${CATN8_DEPLOY_USER:-}" ]]; then
  echo "[deploy.sh] Error: CATN8_DEPLOY_USER must be set (in .env/.env.local or exported env)" >&2
  exit 1
fi
catn8_secret_require CATN8_DEPLOY_PASS

HOST="${CATN8_DEPLOY_HOST}"
USER="${CATN8_DEPLOY_USER}"
PASS="${CATN8_DEPLOY_PASS}"
REMOTE_PATH="/"
# Optional public base for sites under a subdirectory (e.g., /wf)
PUBLIC_BASE="${CATN8_PUBLIC_BASE:-}"
# Parameterized deployment base URL (protocol+host)
DEPLOY_BASE_URL="${DEPLOY_BASE_URL:-https://catn8.us}"
BASE_URL="${DEPLOY_BASE_URL}${PUBLIC_BASE}"

# Deployment modes
# CATN8_FULL_REPLACE=1 forces a full overwrite of all included files and deletes orphans
if [ "${CATN8_FULL_REPLACE:-0}" = "1" ]; then
  MIRROR_FLAGS="--reverse --delete --verbose --no-perms --overwrite"
else
  # Default fast mode: compare by size (ignore mtime) and only upload newer
  MIRROR_FLAGS="--reverse --delete --verbose --only-newer --ignore-time --no-perms"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure a fresh frontend build via the shared release orchestrator (build-only)
if [ "${CATN8_SKIP_RELEASE_BUILD:-0}" != "1" ]; then
  echo -e "${GREEN}🏗  Running release.sh build (no deploy)...${NC}"
  bash scripts/release.sh --no-deploy
fi

echo -e "${GREEN}🚀 Starting fast file deployment...${NC}"
if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
  echo -e "${YELLOW}DRY-RUN: Skipping live website backup API call${NC}"
else
  echo -e "${GREEN}💾 Backing up website...${NC}"
  if [[ -n "${CATN8_ADMIN_TOKEN:-}" ]]; then
    curl -s -X POST "${BASE_URL}/api/backup_website.php?admin_token=${CATN8_ADMIN_TOKEN}" || echo -e "${YELLOW}⚠️  Website backup failed, continuing deployment...${NC}"
  else
    echo -e "${YELLOW}⚠️  CATN8_ADMIN_TOKEN not set; skipping live backup API call${NC}"
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
cat > preclean_remote.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
open sftp://$USER:$PASS@$HOST
rm -f .tmp* ".tmp2 *" *.bak *.bak.* *\ 2 *\ 3 *\ 2.* *\ 3.* || true
cd src || true
rm -f .tmp* ".tmp2 *" *.bak *.bak.* *\ 2 *\ 3 *\ 2.* *\ 3.* || true
cd styles || true
rm -f .tmp* ".tmp2 *" *.bak *.bak.* *\ 2 *\ 3 *\ 2.* *\ 3.* || true
cd .. || true
cd js || true
rm -f .tmp* ".tmp2 *" *.bak *.bak.* *\ 2 *\ 3 *\ 2.* *\ 3.* || true
cd / || true
cd images || true
rm -f .tmp* ".tmp2 *" *.bak *.bak.* *\ 2.* *\ 3.* || true
cd items || true
rm -f .tmp* ".tmp2 *" *.bak *.bak.* *\ 2.* *\ 3.* || true
cd / || true
bye
EOL

if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
  echo -e "${YELLOW}DRY-RUN: Skipping lftp pre-clean step${NC}"
  rm -f preclean_remote.txt
else
  lftp -f preclean_remote.txt || true
  rm -f preclean_remote.txt
fi

# Quarantine any new duplicate files created during build
echo -e "${GREEN}🧹 Quarantining any duplicate files created during build...${NC}"
bash scripts/dev/quarantine_duplicates.sh || true

# Create lftp commands for file deployment
echo -e "${GREEN}📁 Preparing file deployment...${NC}"
cat > deploy_commands.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
open sftp://$USER:$PASS@$HOST
# Note: SFTP lacks checksums. In full-replace mode we use --overwrite to force upload.
# In fast mode, we use size-only + only-newer to avoid re-uploading identical files.
mirror $MIRROR_FLAGS \
  --exclude-glob .git/ \
  --exclude-glob node_modules/ \
  --exclude-glob .vscode/ \
  --exclude-glob hot \
  --exclude-glob sessions/** \
  --exclude-glob .env \
  --exclude-glob .env.* \
  --exclude-glob backups/duplicates/** \
  --exclude-glob backups/tests/** \
  --include-glob backups/**/*.sql \
  --include-glob backups/**/*.sql.gz \
  --exclude-glob backups/** \
  --exclude-glob documentation/ \
  --exclude-glob Documentation/ \
  --include-glob documentation/.htaccess \
  --include-glob reports/.htaccess \
  --exclude-glob *.log \
  --exclude-glob *.sh \
  --exclude-glob *.plist \
  --exclude-glob temp_cron.txt \
  --exclude-glob SERVER_MANAGEMENT.md \
  --exclude-glob factory-tutorial/ \
  --exclude-glob backup.sql \
  --exclude-glob backup_*.tar.gz \
  --exclude-glob *_backup_*.tar.gz \
  --exclude-glob .tmp* \
  --exclude-glob ".tmp2 *" \
  --exclude-glob deploy_commands.txt \
  --exclude-glob fix_clown_frog_image.sql \
  --exclude-glob images/.htaccess \
  --exclude-glob images/items/.htaccess \
  --exclude-glob config/my.cnf \
  --exclude-glob config/secret.key \
  --exclude-glob "* [0-9].*" \
  --exclude-glob "* [0-9]/*" \
  --exclude-glob "* copy*" \
  --include-glob credentials.json \
  . $REMOTE_PATH
bye
EOL

# Run lftp with the commands
echo -e "${GREEN}🌐 Deploying files to server...${NC}"
if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
  echo -e "${YELLOW}DRY-RUN: Skipping lftp mirror (file deployment)${NC}"
  DRY_DEPLOY_SUCCESS=1
else
  if lftp -f deploy_commands.txt; then
    DRY_DEPLOY_SUCCESS=1
  else
    DRY_DEPLOY_SUCCESS=0
  fi
fi
if [ "${DRY_DEPLOY_SUCCESS}" = "1" ]; then
  echo -e "${GREEN}✅ Files deployed successfully${NC}"
  # Optional: Upload maintenance utility (disabled by default to avoid mkdir errors on some hosts)
  if [ "${CATN8_UPLOAD_MAINTENANCE:-0}" = "1" ]; then
    echo -e "${GREEN}🧰 Uploading maintenance utilities (prune_sessions.sh)...${NC}"
    cat > upload_maintenance.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
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
  if [ -f ".env.live" ] && [ "${CATN8_UPLOAD_LIVE_ENV:-0}" = "1" ]; then
    echo -e "${GREEN}🔐 Uploading live environment file (.env.live -> .env)...${NC}"
    cat > upload_env.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit no
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
  # Secondary passes are unnecessary in full-replace mode
  if [ "${CATN8_FULL_REPLACE:-0}" != "1" ]; then
    # Perform a second, targeted mirror for images/backgrounds WITHOUT --ignore-time
    # Rationale: when replacing background files with the same size but different content,
    # the size-only comparison (from --ignore-time) may skip the upload. This pass uses
    # mtime to ensure changed files are uploaded.
    echo -e "${GREEN}🖼️  Ensuring background images are updated (mtime-based)...${NC}"
    cat > deploy_backgrounds.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
open sftp://$USER:$PASS@$HOST
mirror --reverse --delete --verbose --only-newer --no-perms \
  images/backgrounds images/backgrounds
bye
EOL
    if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
      echo -e "${YELLOW}DRY-RUN: Skipping backgrounds sync (mtime-based)${NC}"
    elif lftp -f deploy_backgrounds.txt; then
      echo -e "${GREEN}✅ Background images synced (mtime-based)${NC}"
    else
      echo -e "${YELLOW}⚠️  Background image sync failed; continuing${NC}"
    fi
    rm -f deploy_backgrounds.txt
    # Perform a second, targeted mirror for dist WITHOUT --ignore-time
    # Rationale: manifest.json and hashed bundles can change without size changes; ensure they upload
    echo -e "${GREEN}📦 Ensuring dist assets & manifest are updated (mtime-based)...${NC}"
    cat > deploy_dist.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
open sftp://$USER:$PASS@$HOST
mirror --reverse --delete --verbose --only-newer --no-perms \
  dist dist
bye
EOL
    if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
      echo -e "${YELLOW}DRY-RUN: Skipping dist sync (mtime-based)${NC}"
    elif lftp -f deploy_dist.txt; then
      echo -e "${GREEN}✅ Dist assets & manifest synced (mtime-based)${NC}"
    else
      echo -e "${YELLOW}⚠️  Dist sync failed; continuing${NC}"
    fi
    rm -f deploy_dist.txt
  fi
else
  echo -e "${RED}❌ File deployment failed${NC}"
  rm deploy_commands.txt
  exit 1
fi

# Clean up lftp commands file
rm deploy_commands.txt

# Ensure no Vite hot file exists on the live server (prevents accidental dev mode)
echo -e "${GREEN}🧹 Removing any stray Vite hot file on server...${NC}"
cat > cleanup_hot.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
open sftp://$USER:$PASS@$HOST
rm -f hot
bye
EOL

if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
  echo -e "${YELLOW}DRY-RUN: Skipping remote hot file cleanup${NC}"
else
  lftp -f cleanup_hot.txt > /dev/null 2>&1 || true
fi
rm cleanup_hot.txt

# Verify deployment (HTTP-based, avoids dotfile visibility issues)
echo -e "${GREEN}🔍 Verifying deployment over HTTP...${NC}"

# Check Vite manifest availability (prefer .vite/manifest.json)
HTTP_MANIFEST_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/dist/.vite/manifest.json")
if [ "$HTTP_MANIFEST_CODE" != "200" ]; then
  HTTP_MANIFEST_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/dist/manifest.json")
fi
if [ "$HTTP_MANIFEST_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Vite manifest accessible over HTTP${NC}"
else
  echo -e "${YELLOW}⚠️  Vite manifest not accessible over HTTP (code $HTTP_MANIFEST_CODE)${NC}"
fi

# Extract one JS and one CSS asset from homepage HTML and verify
HOME_HTML=$(curl -s "$BASE_URL/")
APP_JS=$(echo "$HOME_HTML" | grep -Eo "/dist/assets/js/app.js-[^\"']+\\.js" | head -n1)
MAIN_CSS=$(echo "$HOME_HTML" | grep -Eo "/dist/assets/[^\"']+\\.css" | head -n1)
if [ -n "$APP_JS" ]; then
  CODE_JS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$APP_JS")
  echo -e "  • JS $APP_JS -> HTTP $CODE_JS"
else
  echo -e "  • JS: ⚠️ Not found in homepage HTML"
fi
if [ -n "$MAIN_CSS" ]; then
  CODE_CSS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$MAIN_CSS")
  echo -e "  • CSS $MAIN_CSS -> HTTP $CODE_CSS"
else
  echo -e "  • CSS: ⚠️ Not found in homepage HTML"
fi

# Fix permissions automatically after deployment
echo -e "${GREEN}🔧 Fixing image permissions on server...${NC}"
# Remove problematic .htaccess files and fix permissions via SFTP
cat > fix_permissions.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
open sftp://$USER:$PASS@$HOST
rm -f images/.htaccess
rm -f images/items/.htaccess
chmod 755 images/
chmod 755 images/items/
chmod 644 images/items/*
bye
EOL

if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
  echo -e "${YELLOW}DRY-RUN: Skipping remote permissions fix${NC}"
else
  lftp -f fix_permissions.txt > /dev/null 2>&1 || true
fi
rm fix_permissions.txt

# List duplicate-suffixed files on server (for visibility)
echo -e "${GREEN}🧹 Listing duplicate-suffixed files on server (space-number)...${NC}"
cat > list_server_duplicates.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
open sftp://$USER:$PASS@$HOST
# images root
cls -1 images/*\\ 2.* || true
cls -1 images/*\\ 3.* || true
# subdirs
cls -1 images/items/*\\ 2.* || true
cls -1 images/items/*\\ 3.* || true
cls -1 images/backgrounds/*\\ 2.* || true
cls -1 images/backgrounds/*\\ 3.* || true
cls -1 images/logos/*\\ 2.* || true
cls -1 images/logos/*\\ 3.* || true
cls -1 images/signs/*\\ 2.* || true
cls -1 images/signs/*\\ 3.* || true
bye
EOL
if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
  echo -e "${YELLOW}DRY-RUN: Skipping remote duplicate listing${NC}"
else
  lftp -f list_server_duplicates.txt || true
fi
rm list_server_duplicates.txt

# Delete duplicate-suffixed files on server
echo -e "${GREEN}🧽 Removing duplicate-suffixed files on server...${NC}"
cat > delete_server_duplicates.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
open sftp://$USER:$PASS@$HOST
rm -f images/*\\ 2.* || true
rm -f images/*\\ 3.* || true
rm -f images/items/*\\ 2.* || true
rm -f images/items/*\\ 3.* || true
rm -f images/backgrounds/*\\ 2.* || true
rm -f images/backgrounds/*\\ 3.* || true
rm -f images/logos/*\\ 2.* || true
rm -f images/logos/*\\ 3.* || true
rm -f images/signs/*\\ 2.* || true
rm -f images/signs/*\\ 3.* || true
bye
EOL
if [ "${CATN8_DRY_RUN:-0}" = "1" ]; then
  echo -e "${YELLOW}DRY-RUN: Skipping remote duplicate deletion${NC}"
else
  lftp -f delete_server_duplicates.txt || true
fi
rm delete_server_duplicates.txt

# Test image accessibility (use a stable asset; path can be overridden)
echo -e "${GREEN}🌍 Testing image accessibility...${NC}"
TEST_LOGO_PATH="${BRAND_LOGO_PATH:-/images/catn8_logo.jpeg}"
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
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_LOGO_URL")
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
echo -e "  • Images: ✅ Included in deployment"
echo -e "  • Verification: ✅ Completed"

echo -e "\n${GREEN}🎉 Fast deployment completed!${NC}"
echo -e "${YELLOW}💡 Use ./deploy_full.sh when you need to update the database${NC}"
