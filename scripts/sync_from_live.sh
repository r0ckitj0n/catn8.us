#!/usr/bin/env bash
# Sync LIVE → local so the dev tree stays current with production assets.
# Prevents stale local images/code from later overwriting newer live copies.
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE_LOCAL="$ROOT_DIR/.env.local"
ENV_FILE="$ROOT_DIR/.env"
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

# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/secrets/env_or_keychain.sh"

usage() {
  cat <<'USAGE'
Usage: scripts/sync_from_live.sh [options]

Pull current files from LIVE into the local/dev tree so newer live images
(and optional paths) are not later overwritten by older local copies.

Modes:
  --refresh          Update missing files and replace local copies that differ
                     from live by size (default)
  --missing-only     Download only files that do not exist locally

Transport:
  --auto             Prefer SFTP when credentials + lftp exist; else HTTP (default)
  --sftp-only        Require SFTP (lftp + CATN8_DEPLOY_*)
  --http-only        Refresh via public HTTPS (existing local image paths only;
                     cannot discover live-only files)

Paths:
  --images           Sync images/ (default when no --paths given)
  --paths <list>     Comma-separated remote roots (e.g. images,images/mystery)
  --code-hotfixes    Also pull api/ and includes/ (SFTP only; use with care)

Other:
  --dry-run          Report actions without writing files
  --base-url <url>   Public site base for HTTP mode (default: CATN8_DEPLOY_BASE_URL
                     or https://catn8.us)
  --help             Show this help

Artifacts are written under .local/state/sync-from-live/<timestamp>/.
USAGE
}

MODE="refresh"
TRANSPORT="auto"
SYNC_IMAGES=0
PATHS_EXPLICIT=""
CODE_HOTFIXES=0
DRY_RUN=0
BASE_URL="${CATN8_DEPLOY_BASE_URL:-${DEPLOY_BASE_URL:-https://catn8.us}}"
CURL_CONNECT_TIMEOUT="${CATN8_CURL_CONNECT_TIMEOUT_SEC:-10}"
CURL_MAX_TIME="${CATN8_CURL_MAX_TIME_SEC:-120}"
LFTP_NET_TIMEOUT="${CATN8_LFTP_TIMEOUT_SEC:-30}"
LFTP_NET_MAX_RETRIES="${CATN8_LFTP_MAX_RETRIES:-1}"
LFTP_NET_SETTINGS=$'set net:timeout '"${LFTP_NET_TIMEOUT}"$'\nset net:max-retries '"${LFTP_NET_MAX_RETRIES}"$'\nset net:reconnect-interval-base 5\nset net:reconnect-interval-max 15'

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --refresh)
      MODE="refresh"
      shift
      ;;
    --missing-only)
      MODE="missing-only"
      shift
      ;;
    --auto)
      TRANSPORT="auto"
      shift
      ;;
    --sftp-only)
      TRANSPORT="sftp"
      shift
      ;;
    --http-only)
      TRANSPORT="http"
      shift
      ;;
    --images)
      SYNC_IMAGES=1
      shift
      ;;
    --paths)
      if [[ -z "${2:-}" ]]; then
        echo "Error: --paths requires a comma-separated path list." >&2
        exit 2
      fi
      PATHS_EXPLICIT="$2"
      shift 2
      ;;
    --code-hotfixes)
      CODE_HOTFIXES=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --base-url)
      if [[ -z "${2:-}" ]]; then
        echo "Error: --base-url requires a URL." >&2
        exit 2
      fi
      BASE_URL="$2"
      shift 2
      ;;
    *)
      echo "Error: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

BASE_URL="${BASE_URL%/}"

declare -a SYNC_PATHS=()
if [[ -n "$PATHS_EXPLICIT" ]]; then
  IFS=',' read -r -a PATHS_ARR <<< "$PATHS_EXPLICIT"
  for p in "${PATHS_ARR[@]}"; do
    trimmed="$(echo "$p" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s#^/##;s#/$##')"
    if [[ -n "$trimmed" ]]; then
      SYNC_PATHS+=("$trimmed")
    fi
  done
elif [[ "$SYNC_IMAGES" == "1" ]] || [[ "$CODE_HOTFIXES" != "1" ]]; then
  # Default: images only (unless user asked only for code hotfixes).
  SYNC_PATHS+=("images")
fi

if [[ "$CODE_HOTFIXES" == "1" ]]; then
  SYNC_PATHS+=("api" "includes")
fi

if [[ ${#SYNC_PATHS[@]} -eq 0 ]]; then
  echo "Error: no sync paths selected." >&2
  exit 2
fi

# Refuse dangerous roots.
for p in "${SYNC_PATHS[@]}"; do
  case "$p" in
    ""|"."|".."|"/"|".git"|"node_modules"|"vendor"|".env"*|"config")
      echo "Error: refusing to sync dangerous path: ${p}" >&2
      exit 2
      ;;
  esac
done

STATE_ROOT="$ROOT_DIR/.local/state/sync-from-live"
TS="$(date +%Y%m%d-%H%M%S)"
STATE_DIR="$STATE_ROOT/$TS"
mkdir -p "$STATE_DIR"
SUMMARY_FILE="$STATE_DIR/summary.txt"
REPORT_FILE="$STATE_DIR/actions.tsv"
printf 'path\taction\tdetail\n' > "$REPORT_FILE"

log() { printf '%s\n' "$*" | tee -a "$SUMMARY_FILE"; }
have_sftp() {
  command -v lftp >/dev/null 2>&1 || return 1
  [[ -n "${CATN8_DEPLOY_HOST:-}" ]] || return 1
  [[ -n "${CATN8_DEPLOY_USER:-}" ]] || return 1
  if catn8_secret_get CATN8_DEPLOY_PASS >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

UPDATED=0
SKIPPED=0
MISSING_REMOTE=0
FAILED=0
DOWNLOADED_MISSING=0

http_sync_images_tree() {
  local root_path="$1"
  local local_root="$ROOT_DIR/$root_path"
  if [[ ! -d "$local_root" ]]; then
    log "HTTP: skipping ${root_path} (local directory missing; use SFTP to create from live)"
    return 0
  fi

  log "HTTP: refreshing ${root_path}/ from ${BASE_URL}/${root_path}/ (${MODE})"
  local file rel url headers http_code remote_len remote_lm local_sz action detail tmp
  while IFS= read -r -d '' file; do
    rel="${file#"$ROOT_DIR"/}"
    url="${BASE_URL}/${rel}"
    headers="$(mktemp)"
    http_code="$(curl -sS -I --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time 30 \
      -o "$headers" -w "%{http_code}" "$url" || true)"
    if [[ "$http_code" != "200" ]]; then
      MISSING_REMOTE=$((MISSING_REMOTE + 1))
      printf '%s\tskip_remote_%s\t%s\n' "$rel" "$http_code" "" >> "$REPORT_FILE"
      SKIPPED=$((SKIPPED + 1))
      rm -f "$headers"
      continue
    fi
    remote_len="$(awk -F': ' 'BEGIN{IGNORECASE=1} tolower($1)=="content-length"{gsub(/\r/,"",$2); print $2; exit}' "$headers")"
    remote_lm="$(awk -F': ' 'BEGIN{IGNORECASE=1} tolower($1)=="last-modified"{gsub(/\r/,"",$2); print $2; exit}' "$headers")"
    rm -f "$headers"
    local_sz="$(wc -c < "$file" | tr -d ' ')"

    action="skip_same"
    detail="size=${local_sz}"
    if [[ "$MODE" == "missing-only" ]]; then
      # File already exists locally.
      SKIPPED=$((SKIPPED + 1))
      printf '%s\t%s\t%s\n' "$rel" "$action" "$detail" >> "$REPORT_FILE"
      continue
    fi

    if [[ -n "$remote_len" && "$remote_len" != "$local_sz" ]]; then
      action="update_size_mismatch"
      detail="local=${local_sz};live=${remote_len};lm=${remote_lm}"
    else
      SKIPPED=$((SKIPPED + 1))
      printf '%s\t%s\t%s\n' "$rel" "$action" "$detail" >> "$REPORT_FILE"
      continue
    fi

    if [[ "$DRY_RUN" == "1" ]]; then
      UPDATED=$((UPDATED + 1))
      printf '%s\tdry_run_%s\t%s\n' "$rel" "$action" "$detail" >> "$REPORT_FILE"
      continue
    fi

    tmp="$(mktemp)"
    if curl -fsS --connect-timeout "${CURL_CONNECT_TIMEOUT}" --max-time "${CURL_MAX_TIME}" \
      -o "$tmp" "$url"; then
      mv "$tmp" "$file"
      UPDATED=$((UPDATED + 1))
      printf '%s\t%s\t%s\n' "$rel" "$action" "$detail" >> "$REPORT_FILE"
    else
      rm -f "$tmp"
      FAILED=$((FAILED + 1))
      printf '%s\tfail_download\t%s\n' "$rel" "$detail" >> "$REPORT_FILE"
    fi
  done < <(find "$local_root" -type f -print0)
}

sftp_sync_path() {
  local remote_path="$1"
  local mirror_flags
  if [[ "$MODE" == "missing-only" ]]; then
    mirror_flags="--verbose --only-missing --no-perms"
  else
    # Size-aware refresh: pull missing files and replace local copies whose size differs.
    mirror_flags="--verbose --ignore-time --no-perms"
  fi

  local pass host user
  host="${CATN8_DEPLOY_HOST}"
  user="${CATN8_DEPLOY_USER}"
  pass="$(catn8_secret_get CATN8_DEPLOY_PASS)"
  export CATN8_DEPLOY_PASS="$pass"

  log "SFTP: syncing /${remote_path} → local (${MODE})"
  local lftp_file="$STATE_DIR/sync_${remote_path//\//_}.lftp"
  cat > "$lftp_file" <<EOL
set sftp:auto-confirm yes
set ssl:verify-certificate no
set cmd:fail-exit yes
${LFTP_NET_SETTINGS}
open sftp://${user}:${pass}@${host}
mirror ${mirror_flags} \\
  --exclude-glob ".git/**" \\
  --exclude-glob ".git" \\
  --exclude-glob ".gitignore" \\
  --exclude-glob ".local/**" \\
  --exclude-glob "backups/**" \\
  --exclude-glob "logs/**" \\
  --exclude-glob ".DS_Store" \\
  --exclude-glob "**/.DS_Store" \\
  --exclude-glob "* [0-9]*" \\
  ${remote_path} ${remote_path}
bye
EOL

  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY-RUN: would run lftp mirror for ${remote_path} (${mirror_flags})"
    printf '%s\tdry_run_sftp_mirror\t%s\n' "$remote_path" "$mirror_flags" >> "$REPORT_FILE"
    return 0
  fi

  if lftp -f "$lftp_file"; then
    printf '%s\tsftp_mirror_ok\t%s\n' "$remote_path" "$mirror_flags" >> "$REPORT_FILE"
  else
    FAILED=$((FAILED + 1))
    printf '%s\tsftp_mirror_fail\t%s\n' "$remote_path" "$mirror_flags" >> "$REPORT_FILE"
    log "WARNING: SFTP mirror failed for ${remote_path}"
  fi
}

RESOLVED_TRANSPORT="$TRANSPORT"
if [[ "$TRANSPORT" == "auto" ]]; then
  if have_sftp; then
    RESOLVED_TRANSPORT="sftp"
  else
    RESOLVED_TRANSPORT="http"
    log "Info: SFTP unavailable (need lftp + CATN8_DEPLOY_HOST/USER/PASS); using HTTP refresh."
  fi
fi

if [[ "$RESOLVED_TRANSPORT" == "sftp" ]]; then
  if ! have_sftp; then
    echo "Error: --sftp-only requires lftp and CATN8_DEPLOY_HOST/USER/PASS." >&2
    exit 1
  fi
  if [[ "$CODE_HOTFIXES" == "1" ]]; then
    log "WARNING: --code-hotfixes pulls live api/ and includes/ over local. Review git status after."
  fi
  for p in "${SYNC_PATHS[@]}"; do
    sftp_sync_path "$p"
  done
else
  if [[ "$CODE_HOTFIXES" == "1" ]]; then
    echo "Error: --code-hotfixes requires SFTP (HTTP cannot safely mirror PHP trees)." >&2
    exit 2
  fi
  for p in "${SYNC_PATHS[@]}"; do
    case "$p" in
      images|images/*)
        http_sync_images_tree "$p"
        ;;
      *)
        log "HTTP: skipping ${p} (HTTP mode only refreshes images/* trees)"
        ;;
    esac
  done
fi

{
  echo "Sync from live complete."
  echo "  timestamp:   $TS"
  echo "  mode:        $MODE"
  echo "  transport:   $RESOLVED_TRANSPORT"
  echo "  paths:       ${SYNC_PATHS[*]}"
  echo "  dry_run:     $DRY_RUN"
  echo "  updated:     $UPDATED"
  echo "  skipped:     $SKIPPED"
  echo "  remote_miss: $MISSING_REMOTE"
  echo "  failed:      $FAILED"
  echo "  state_dir:   $STATE_DIR"
} | tee -a "$SUMMARY_FILE"

if [[ "$FAILED" -gt 0 ]]; then
  exit 1
fi
exit 0
