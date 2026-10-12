#!/usr/bin/env bash
# Remove macOS duplicate-suffix git refs (e.g. "main 2") that break fetch/pull.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

if [[ ! -d .git ]]; then
  echo "Not a git repository: ${ROOT}" >&2
  exit 1
fi

removed=0
while IFS= read -r -d '' ref; do
  echo "Removing broken duplicate ref: ${ref}"
  rm -f "${ref}"
  removed=$((removed + 1))
done < <(find .git/refs -type f -name '* 2' -print0 2>/dev/null || true)

echo "Removed ${removed} duplicate ref file(s)."
git remote prune origin || true
git fetch --prune origin
echo "Fetch OK. Try: git checkout main && git pull origin main"
