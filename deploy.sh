#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
NODE_ENV=production npx sequelize-cli db:migrate --env production
# Replace the old npm/watch launcher and stop a one-time bootstrap worker.
for app in carisma_backend carisma_carparts carisma_carparts_bootstrap; do
  if pm2 describe "$app" >/dev/null 2>&1; then pm2 delete "$app"; fi
done
pm2 start ecosystem.config.cjs
pm2 save
for attempt in {1..20}; do
  if curl -fsS 'http://127.0.0.1:5050/api/public/product?limit=1' >/dev/null; then exit 0; fi
  sleep 2
done
echo 'API health check failed' >&2
exit 1
