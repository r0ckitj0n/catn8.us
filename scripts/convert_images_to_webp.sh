#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGES_DIR="${ROOT_DIR}/images"
QUALITY="${WEBP_QUALITY:-100}"

if ! command -v cwebp >/dev/null 2>&1; then
  echo "Error: cwebp is not installed. Install WebP tools first."
  exit 1
fi

if [[ ! -d "${IMAGES_DIR}" ]]; then
  echo "Error: images directory not found: ${IMAGES_DIR}"
  exit 1
fi

converted=0
skipped=0
failed=0

while IFS= read -r -d '' src; do
  dst="${src%.*}.webp"

  if [[ -f "${dst}" && "${dst}" -nt "${src}" ]]; then
    skipped=$((skipped + 1))
    continue
  fi

  if cwebp -quiet -mt -m 6 -q "${QUALITY}" -alpha_q 100 -exact "${src}" -o "${dst}"; then
    converted=$((converted + 1))
  else
    failed=$((failed + 1))
    echo "Failed: ${src}"
  fi
done < <(find "${IMAGES_DIR}" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) -print0)

echo "WebP conversion complete."
echo "Converted: ${converted}"
echo "Skipped (up-to-date): ${skipped}"
echo "Failed: ${failed}"

if [[ "${failed}" -gt 0 ]]; then
  exit 1
fi
