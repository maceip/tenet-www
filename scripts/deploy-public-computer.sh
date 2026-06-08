#!/usr/bin/env bash
# Sync Vite dist/ to https://public.computer/tenet/
#
# Usage:
#   PUBLIC_COMPUTER_USER=stare PUBLIC_COMPUTER_REMOTE=/path/on/host/tenet/ ./scripts/deploy-public-computer.sh
#
# Env (defaults shown):
#   PUBLIC_COMPUTER_HOST=142.248.222.1
#   PUBLIC_COMPUTER_USER=stare
#   PUBLIC_COMPUTER_SSH_KEY=$HOME/.ssh/tenet-nitro.pem
#   PUBLIC_COMPUTER_REMOTE=   (required — remote directory ending in /tenet/)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOST="${PUBLIC_COMPUTER_HOST:-142.248.222.1}"
USER="${PUBLIC_COMPUTER_USER:-stare}"
KEY="${PUBLIC_COMPUTER_SSH_KEY:-$HOME/.ssh/tenet-nitro.pem}"
REMOTE="${PUBLIC_COMPUTER_REMOTE:-}"

if [[ -z "$REMOTE" ]]; then
  echo "Set PUBLIC_COMPUTER_REMOTE to the server path for /tenet/ (e.g. /var/www/public.computer/tenet/)" >&2
  exit 1
fi

npm run build

echo "[deploy] rsync dist/ -> ${USER}@${HOST}:${REMOTE}"
rsync -avz --delete \
  -e "ssh -i ${KEY} -o StrictHostKeyChecking=accept-new" \
  dist/ "${USER}@${HOST}:${REMOTE}"

echo "[deploy] done — verify: https://public.computer/tenet/"
