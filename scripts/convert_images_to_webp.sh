#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QUALITY="${WEBP_QUALITY:-100}"
IMAGE_DIRS=(
  "${ROOT_DIR}/images"
  "${ROOT_DIR}/public/images"
  "${ROOT_DIR}/public/emojis/twemoji"
)

if ! command -v cwebp >/dev/null 2>&1; then
  echo "Error: cwebp is not installed. Install WebP tools first."
  exit 1
fi

if ! command -v magick >/dev/null 2>&1; then
  echo "Error: ImageMagick (magick) is not installed."
  exit 1
fi

png_created=0
png_skipped=0
png_failed=0
webp_created=0
webp_skipped=0
webp_failed=0

has_alpha_channel() {
  local src="$1"
  local channels

  if ! channels="$(magick identify -quiet -format '%[channels]' "${src}" 2>/dev/null)"; then
    return 1
  fi

  channels="$(printf '%s' "${channels}" | tr '[:upper:]' '[:lower:]')"
  [[ "${channels}" == *a* ]]
}

convert_to_png() {
  local src="$1"
  local dst="$2"

  mkdir -p "$(dirname "${dst}")"
  magick "${src}" -auto-orient PNG32:"${dst}"
}

convert_to_webp_lossless() {
  local src="$1"
  local dst="$2"

  mkdir -p "$(dirname "${dst}")"
  cwebp -quiet -mt -m 6 -lossless -alpha_q 100 -exact "${src}" -o "${dst}"
}

convert_to_webp_lossy() {
  local src="$1"
  local dst="$2"

  mkdir -p "$(dirname "${dst}")"
  cwebp -quiet -mt -m 6 -q "${QUALITY}" -alpha_q 100 -exact "${src}" -o "${dst}"
}

for dir in "${IMAGE_DIRS[@]}"; do
  [[ -d "${dir}" ]] || continue

  while IFS= read -r -d '' src; do
    case "${src}" in
      *.ico|*.ICO) continue ;;
    esac

    ext="${src##*.}"
    ext="$(printf '%s' "${ext}" | tr '[:upper:]' '[:lower:]')"
    base="${src%.*}"
    png_dst="${base}.png"
    webp_dst="${base}.webp"

    if [[ "${ext}" != "png" && "${ext}" != "webp" ]]; then
      if [[ -f "${png_dst}" && "${png_dst}" -nt "${src}" ]]; then
        png_skipped=$((png_skipped + 1))
      else
        if convert_to_png "${src}" "${png_dst}"; then
          png_created=$((png_created + 1))
        else
          png_failed=$((png_failed + 1))
          echo "Failed PNG conversion: ${src}"
        fi
      fi
    fi

    if [[ "${ext}" == "webp" ]]; then
      continue
    fi

    if [[ -f "${webp_dst}" && "${webp_dst}" -nt "${src}" && ( "${ext}" == "png" || ! -f "${png_dst}" || "${webp_dst}" -nt "${png_dst}" ) ]]; then
      webp_skipped=$((webp_skipped + 1))
      continue
    fi

    webp_src="${src}"
    if [[ "${ext}" == "png" ]]; then
      if convert_to_webp_lossless "${src}" "${webp_dst}"; then
        webp_created=$((webp_created + 1))
      else
        webp_failed=$((webp_failed + 1))
        echo "Failed WebP conversion: ${src}"
      fi
      continue
    fi

    if [[ -f "${png_dst}" ]] && has_alpha_channel "${png_dst}"; then
      webp_src="${png_dst}"
      if convert_to_webp_lossless "${webp_src}" "${webp_dst}"; then
        webp_created=$((webp_created + 1))
      else
        webp_failed=$((webp_failed + 1))
        echo "Failed WebP conversion: ${src}"
      fi
      continue
    fi

    if convert_to_webp_lossy "${src}" "${webp_dst}"; then
      webp_created=$((webp_created + 1))
    else
      webp_failed=$((webp_failed + 1))
      echo "Failed WebP conversion: ${src}"
    fi
  done < <(find "${dir}" -type f \( -iname '*.avif' -o -iname '*.bmp' -o -iname '*.gif' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.tif' -o -iname '*.tiff' \) -print0)
done

echo "Image compatibility conversion complete."
echo "PNG created: ${png_created}"
echo "PNG skipped (up-to-date): ${png_skipped}"
echo "PNG failed: ${png_failed}"
echo "WebP created: ${webp_created}"
echo "WebP skipped (up-to-date): ${webp_skipped}"
echo "WebP failed: ${webp_failed}"

if [[ "${png_failed}" -gt 0 || "${webp_failed}" -gt 0 ]]; then
  exit 1
fi
