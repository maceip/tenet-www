#!/usr/bin/env bash
# Build tenet-www and publish to public.computer/tenet/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${TENET_WWW_DEPLOY:-stare-origin:/var/www/public.computer/tenet}"

cd "$ROOT"
node scripts/refresh-network-status.mjs
npm run build

echo "[deploy] rsync dist/ -> $DEST"
rsync -avz --delete "$ROOT/dist/" "$DEST/"

echo "[deploy] done — https://public.computer/tenet/"
