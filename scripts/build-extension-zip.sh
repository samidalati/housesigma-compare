#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT="$ROOT/extension"
OUT="$ROOT/dist"
ZIP="$OUT/housesigma-compare.zip"

required=(
  "$EXT/manifest.json"
  "$EXT/icons/icon16.png"
  "$EXT/icons/icon48.png"
  "$EXT/icons/icon128.png"
  "$EXT/vendor/Sortable.min.js"
)

for f in "${required[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing required file: $f" >&2
    exit 1
  fi
done

mkdir -p "$OUT"
rm -f "$ZIP"
(
  cd "$EXT"
  zip -r "$ZIP" . -x "*.DS_Store" -x "__MACOSX/*"
)

echo "Created $ZIP"
unzip -l "$ZIP" | head -20
