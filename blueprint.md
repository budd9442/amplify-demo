# AWS Amplify Full-Stack (Frontend + Backend) Blueprint

A universal, framework-agnostic guide to deploying any **Frontend (React, Vue, Svelte, Vite, Angular, etc.)** and **Backend (Express, Fastify, Hono, Node.js HTTP, etc.)** on **AWS Amplify Hosting** using the official **SSR Deployment Specification**.

---

## 1. How It Works

AWS Amplify Hosting provides managed compute (running on Node.js / Lambda under CloudFront) alongside static hosting. It does not require separate AWS services (like ECS or App Runner) if you package your application into Amplify's expected layout: **`.amplify-hosting/`**.

### The `.amplify-hosting` Output Structure

```text
.amplify-hosting/
├── static/                <-- Static frontend build output (HTML, CSS, JS, images)
│   ├── assets/
│   ├── favicon.ico
│   └── index.html
├── compute/
│   └── default/           <-- Backend code + production dependencies
│       ├── node_modules/  <-- Installed via `npm ci --omit=dev`
│       ├── apps/api/...   <-- Backend application source code
│       └── index.js       <-- Entrypoint file executed by Amplify compute
└── deploy-manifest.json   <-- Contract defining routing, compute runtime, and fallbacks
```

---

## 2. The 4 Essential Steps

### Step 1: Ensure Your Backend Listens on `PORT`

Amplify assigns a dynamic port (or defaults to `3000`). Your backend must listen on `process.env.PORT`:

```javascript
// server.js
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

---

### Step 2: Add `deploy-manifest.json` in Your Repository Root

Create `deploy-manifest.json` in your project root. This tells Amplify's router:
- Requests starting with `/api/*` route to the **Compute** resource (`default`).
- Requests with file extensions (`/*.*`) check **Static** storage first, with fallback to **Compute**.
- All other paths (`/*`) serve **Static** files (`index.html`).

```json
{
  "version": 1,
  "framework": {
    "name": "express",
    "version": "4.21.2"
  },
  "routes": [
    {
      "path": "/api/*",
      "target": {
        "kind": "Compute",
        "src": "default"
      }
    },
    {
      "path": "/*.*",
      "target": {
        "kind": "Static",
        "cacheControl": "public, max-age=31536000, immutable"
      },
      "fallback": {
        "kind": "Compute",
        "src": "default"
      }
    },
    {
      "path": "/*",
      "target": {
        "kind": "Static"
      }
    }
  ],
  "computeResources": [
    {
      "name": "default",
      "runtime": "nodejs20.x",
      "entrypoint": "index.js"
    }
  ]
}
```

> **Rules for `deploy-manifest.json`**:
> - Never set `fallback` from `Static` to `Static` (e.g. `fallback: { path: "/index.html" }` is invalid).
> - Every `target` and `fallback` must declare a `"kind"` (`"Static"`, `"Compute"`, or `"ImageOptimization"`).

---

### Step 3: Create the Build Assembly Script

Create a script (e.g., `scripts/build-amplify.sh`) that builds your frontend and packages both frontend and backend into `.amplify-hosting/`:

```bash
#!/usr/bin/env bash
set -e

echo "=== 1. Building Frontend ==="
# Adjust to your frontend build command (e.g., npm run build -w @monorepo/web)
npm run build -w @monorepo/web

echo "=== 2. Creating .amplify-hosting structure ==="
rm -rf .amplify-hosting
mkdir -p .amplify-hosting/static
mkdir -p .amplify-hosting/compute/default

echo "=== 3. Copying static frontend assets ==="
# Adjust source path to where your frontend outputs (dist/, build/, or out/)
cp -r apps/web/dist/* .amplify-hosting/static/

echo "=== 4. Copying backend source code ==="
# Copy backend code and root configs
cp -r apps .amplify-hosting/compute/default/
cp -r packages .amplify-hosting/compute/default/
cp package.json package-lock.json .amplify-hosting/compute/default/

echo "=== 4b. Generating compute entrypoint index.js ==="
# Creates an index.js at the root of compute/default
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
```

Make it executable:
```bash
chmod +x scripts/build-amplify.sh
```

In your root `package.json`, add:
```json
"scripts": {
  "build:amplify": "bash scripts/build-amplify.sh"
}
```

---

### Step 4: Configure `amplify.yml`

Create or update `amplify.yml` in your project root:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - nvm use 20 || nvm install 20
        - node -v
        - npm ci
    build:
      commands:
        - npm run build:amplify
  artifacts:
    baseDirectory: .amplify-hosting
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

Add `.amplify-hosting/` to your `.gitignore`:
```text
.amplify-hosting/
```

---

## 3. AWS Amplify Console Setup

When connecting your Git repository in the AWS Amplify Console:

| Setting | Value / Action |
| --- | --- |
| **App root / Monorepo root** | Leave **blank** (runs from repo root) |
| **Frontend build command** | `npm run build:amplify` |
| **Build output directory** | `.amplify-hosting` |
| **Enable SSR app logs** | ☑ **Checked** (Under Advanced settings) |
| **IAM Service Role** | Select or create a role with Amplify permissions |

---

## 4. Troubleshooting Common Errors

### `CustomerError: We failed to validate the deploy-manifest.json`
- **Cause:** Your `deploy-manifest.json` has syntax not conforming to the schema (e.g. `fallback: { path: "/index.html" }` or invalid `kind`).
- **Fix:** Keep fallback to `{ "kind": "Compute", "src": "default" }` or omit it. The static target `/*` serves `index.html` automatically.

### `Deploy cancelled` immediately after `preBuild`
- **Cause:** Missing build step in console, node version mismatch, or corrupted build cache.
- **Fix:** Ensure `nvm use 20` is in `preBuild`, and verify that `build: commands: - npm run build:amplify` exists in `amplify.yml`.

### `/api` routes return 404
- **Cause:** The route order in `deploy-manifest.json` matched a static catch-all first, or entrypoint file failed to start.
- **Fix:** Ensure `/api/*` is the **first** rule in `routes`, and ensure `entrypoint` in `computeResources` points to an existing file in `.amplify-hosting/compute/default/`.
