#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICONS="$ROOT/extension/icons"
SVG="$ICONS/house.svg"
BG="#0d6e6e"

if [[ ! -f "$SVG" ]]; then
  echo "Missing $SVG" >&2
  exit 1
fi

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick (magick) is required." >&2
  exit 1
fi

magick -size 128x128 "xc:$BG" \( "$SVG" -resize 72x72 \) -gravity center -composite PNG32:"$ICONS/icon128.png"
magick "$ICONS/icon128.png" -resize 48x48 PNG32:"$ICONS/icon48.png"
magick "$ICONS/icon128.png" -resize 16x16 PNG32:"$ICONS/icon16.png"
echo "Wrote icon16.png, icon48.png, icon128.png"
