#!/usr/bin/env bash
set -e

echo "=== 1. Building Web App ==="
npm run build -w @monorepo/web

echo "=== 2. Creating .amplify-hosting structure ==="
rm -rf .amplify-hosting
mkdir -p .amplify-hosting/static
mkdir -p .amplify-hosting/compute/default

echo "=== 3. Copying static frontend assets ==="
cp -r apps/web/dist/* .amplify-hosting/static/

echo "=== 4. Copying backend and workspace packages ==="
cp -r apps .amplify-hosting/compute/default/
cp -r packages .amplify-hosting/compute/default/
cp package.json package-lock.json .amplify-hosting/compute/default/

echo "=== 4b. Creating entrypoint for compute ==="
cat << 'EOF' > .amplify-hosting/compute/default/index.js
import './apps/api/src/server.js';
EOF

echo "=== 5. Installing production dependencies for compute ==="
cd .amplify-hosting/compute/default
npm ci --omit=dev
cd ../../..

echo "=== 6. Copying deploy-manifest.json ==="
cp deploy-manifest.json .amplify-hosting/deploy-manifest.json

echo "=== Build Complete: .amplify-hosting ready ==="
ls -la .amplify-hosting
