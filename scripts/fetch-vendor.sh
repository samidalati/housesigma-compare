#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/extension/vendor"
URL="https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js"

mkdir -p "$VENDOR"
curl -fsSL "$URL" -o "$VENDOR/Sortable.min.js"
echo "Wrote $VENDOR/Sortable.min.js ($(wc -c < "$VENDOR/Sortable.min.js") bytes)"
