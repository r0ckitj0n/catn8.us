#!/bin/bash

# Lite incremental deployment to SFTP (changed/missing files only)
# Required config (preferred):
#   CATN8_DEPLOY_HOST, CATN8_DEPLOY_USER
# Required secret (env or macOS Keychain via scripts/secrets/env_or_keychain.sh):
#   CATN8_DEPLOY_PASS
#
# Optional overrides:
#   SFTP_HOST, SFTP_USER, SFTP_PASSWORD (explicitly override CATN8_* if set)
# Optional:
#   SFTP_PORT (default 22), SFTP_REMOTE_PATH (default '/'), CATN8_DEPLOY_DELETE (0 to disable delete)

# Run from repo root regardless of current directory
cd "$(dirname "$0")/.."

echo "catn8.us Lite Deployment"
echo "=============================="

# Load secrets from env or macOS Keychain
# shellcheck disable=SC1091
source "./scripts/secrets/env_or_keychain.sh"

 # Load .env.local if present, else .env
 ENV_FILE_LOCAL="./.env.local"
 ENV_FILE="./.env"
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

# Ensure a fresh frontend build via the shared release orchestrator (build-only)
if [ "${CATN8_SKIP_RELEASE_BUILD:-0}" != "1" ]; then
  echo "[deploy_lite] Running release.sh build (no deploy)..."
  bash scripts/release.sh --no-deploy
fi

# Prefer centralized CATN8_* deploy vars. Allow explicit SFTP_* override if already set.
: "${SFTP_HOST:=${CATN8_DEPLOY_HOST:-}}"
: "${SFTP_USER:=${CATN8_DEPLOY_USER:-}}"

if [[ -z "${SFTP_PASSWORD:-}" ]]; then
  catn8_secret_require CATN8_DEPLOY_PASS
  SFTP_PASSWORD="${CATN8_DEPLOY_PASS}"
fi

: "${SFTP_REMOTE_PATH:=/}"

# Validate environment variables
if [[ -z "${SFTP_HOST:-}" || -z "${SFTP_USER:-}" || -z "${SFTP_PASSWORD:-}" ]]; then
    echo "Error: SFTP credentials not found in environment variables"
    echo "Please ensure SFTP_HOST, SFTP_USER, and SFTP_PASSWORD are set"
    exit 1
fi

echo "Target: $SFTP_USER@$SFTP_HOST:${SFTP_PORT:-22}"

echo "Preparing incremental SFTP deployment (changed or missing files only)..."

# Ensure lftp is available
if ! command -v lftp >/dev/null 2>&1; then
    echo "Error: lftp is not installed or not on PATH."
    echo "Please install lftp (e.g., brew install lftp) and retry."
    exit 1
fi

# Remote configuration
PORT="${SFTP_PORT:-22}"
REMOTE_PATH="${SFTP_REMOTE_PATH:-/}"

echo "Using remote path: $REMOTE_PATH"

# Determine deletion behavior (ON by default)
DELETE_FLAG="--delete"
if [[ "${CATN8_DEPLOY_DELETE:-1}" = "0" ]]; then
  DELETE_FLAG=""
  echo "Remote delete disabled (CATN8_DEPLOY_DELETE=0). Remote-orphaned files will be kept."
else
  echo "Remote delete enabled (default). Set CATN8_DEPLOY_DELETE=0 to skip removing remote-orphaned files."
fi

# Build lftp mirror command file (Main pass: exclude dist and backgrounds)
cat > deploy_commands.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
open sftp://$SFTP_USER:$SFTP_PASSWORD@$SFTP_HOST:$PORT
# Only upload changed or missing files:
#   --reverse   : local -> remote
#   --only-newer: skip if remote is same/newer mtime
#   --no-perms  : don't sync permissions
#   --delete    : optional; remove remote files that no longer exist locally (CATN8_DEPLOY_DELETE=1)
mirror --reverse $DELETE_FLAG --verbose --only-newer --no-perms \
  --exclude-glob .git/ \
  --exclude-glob node_modules/ \
  --exclude-glob vendor/ \
  --exclude-glob .vscode/ \
  --exclude-glob hot \
  --exclude-glob sessions/** \
  --exclude-glob dist/** \
  --exclude-glob dist/ \
  --exclude-glob images/backgrounds/** \
  --exclude-glob backups/duplicates/** \
  --exclude-glob backups/tests/** \
  --include-glob backups/**/*.sql \
  --include-glob backups/**/*.sql.gz \
  --exclude-glob backups/** \
  --exclude-glob documentation/ \
  --exclude-glob Documentation/ \
  --include-glob documentation/.htaccess \
  --include-glob reports/.htaccess \
  --exclude-glob Scripts/ \
  --exclude-glob scripts/ \
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
  --exclude-glob "* [0-9].*" \
  --exclude-glob "* [0-9]/*" \
  --exclude-glob "* copy*" \
  --include-glob credentials.json \
  . $REMOTE_PATH
bye
EOL

echo "Deploying files to $SFTP_HOST ..."
if lftp -f deploy_commands.txt; then
  echo "✅ Deployment completed (incremental)."
  EXIT_CODE=0
else
  echo "❌ Deployment failed."
  EXIT_CODE=1
fi

# Clean up
echo "Cleaning up temporary files..."
rm -f deploy_commands.txt

# Backgrounds pass (mtime-based): images/backgrounds
echo "Syncing backgrounds (mtime-based)..."
cat > deploy_backgrounds.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
open sftp://$SFTP_USER:$SFTP_PASSWORD@$SFTP_HOST:$PORT
mirror --reverse $DELETE_FLAG --verbose --only-newer --no-perms \
  images/backgrounds images/backgrounds
bye
EOL
if lftp -f deploy_backgrounds.txt; then
  echo "✅ Backgrounds synced"
else
  echo "⚠️  Backgrounds sync encountered issues; continuing"
fi
rm -f deploy_backgrounds.txt

# Dist pass (mtime-based): ensure manifest + same-sized bundles update
echo "Syncing dist (mtime-based, delete old bundles)..."
cat > deploy_dist.txt << EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
open sftp://$SFTP_USER:$SFTP_PASSWORD@$SFTP_HOST:$PORT
mirror --reverse $DELETE_FLAG --verbose --only-newer --no-perms \
  dist dist
bye
EOL
if lftp -f deploy_dist.txt; then
  echo "✅ Dist synced"
else
  echo "⚠️  Dist sync encountered issues; continuing"
fi
rm -f deploy_dist.txt

exit $EXIT_CODE
