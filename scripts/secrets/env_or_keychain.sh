#!/usr/bin/env bash
set -euo pipefail

CATN8_KEYCHAIN_SERVICE="${CATN8_KEYCHAIN_SERVICE:-catn8.us}"

catn8_secret_get() {
  local key="$1"
  local val="${!key:-}"

  if [[ -n "${val}" ]]; then
    printf '%s' "${val}"
    return 0
  fi

  if command -v security >/dev/null 2>&1; then
    if val="$(security find-generic-password -s "${CATN8_KEYCHAIN_SERVICE}" -a "${key}" -w 2>/dev/null)"; then
      if [[ -n "${val}" ]]; then
        printf '%s' "${val}"
        return 0
      fi
    fi
  fi

  return 1
}

catn8_secret_require() {
  local key="$1"
  local val

  val="$(catn8_secret_get "${key}" 2>/dev/null || true)"
  if [[ -z "${val}" ]]; then
    echo "Missing secret: ${key}. Set env var or store in Keychain service '${CATN8_KEYCHAIN_SERVICE}' account '${key}'." >&2
    exit 1
  fi

  export "${key}=${val}"
}
