#!/usr/bin/env bash
set -euo pipefail

OUT=.amplify-hosting
rm -rf "$OUT" && mkdir -p "$OUT/static" "$OUT/compute/default"

# 1. Build frontend
echo "=== Building Frontend ==="
npm run build -w @monorepo/web
cp -r apps/web/dist/. "$OUT/static/"

# 2. Bundle backend into a single lean ESM file with esbuild
echo "=== Bundling Backend with esbuild ==="
npx esbuild apps/api/src/server.js \
  --bundle --platform=node --target=node22 --format=esm \
  --minify --sourcemap \
  --banner:js="import{createRequire}from'module';const require=createRequire(import.meta.url);" \
  --outfile="$OUT/compute/default/index.mjs"

echo '{"type":"module"}' > "$OUT/compute/default/package.json"

# 3. Copy manifest
cp deploy-manifest.json "$OUT/deploy-manifest.json"

echo "=== Build Complete: Artifact sizes ==="
du -sh "$OUT"/*
