#!/usr/bin/env bash
# Run on public.computer (cron every 2 min) to keep network-status.json fresh.
# Example crontab:
#   */2 * * * * /var/www/tenet-www/scripts/refresh-status-on-server.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${TENET_STATUS_OUT:-/var/www/public.computer/tenet/network-status.json}"

cd "$ROOT"
node scripts/refresh-network-status.mjs
cp -f "$ROOT/public/network-status.json" "$OUT"
echo "[$(date -Is)] refreshed $OUT"
