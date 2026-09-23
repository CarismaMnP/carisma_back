#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
NODE_ENV=production npx sequelize-cli db:migrate --env production
# Keep the API serving while the photo worker drains in-flight batches.
if pm2 describe carisma_carparts_bootstrap >/dev/null 2>&1; then
  pm2 delete carisma_carparts_bootstrap
fi
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
for attempt in {1..20}; do
  if curl -fsS 'http://127.0.0.1:5050/api/public/product?limit=1' >/dev/null; then exit 0; fi
  sleep 2
done
echo 'API health check failed' >&2
exit 1
