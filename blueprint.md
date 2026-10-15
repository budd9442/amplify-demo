# Full-Stack Deployment Blueprint: AWS Amplify & Zero-Cost Architecture

A production-grade, cost-optimized blueprint for running full-stack applications (Frontend SPA + Node.js/Express Backend) on AWS.

---

## Part 1: Why the Default Approach Is Sub-Optimal

| Issue | Why It Matters | Best-Practice Solution |
|---|---|---|
| **`nodejs20.x`** | Node 20 is nearing end of life; AWS Express guidance uses Node 22. | Use **`nodejs22.x`** for long-term support and V8 performance gains. |
| **Copying `apps/` & `node_modules` into compute** | Bloats artifact (15–30MB+), increases cold starts, and inflates Amplify build minutes billed. | **Bundle backend into a single `index.mjs` with `esbuild`** (~800KB, 0 shipped `node_modules`). |
| **`immutable, max-age=31536000` on `/*.*`** | Unhashed files (`favicon.ico`, `robots.txt`, manifest) get stuck in browser/CDN caches for 1 year. | Only scope immutable caching to hashed `/assets/*`. |
| **`/*.*` falling back to Compute** | Missing static asset requests trigger billed Lambda/Compute invocations. | Route `/*.*` purely to `Static` without Compute fallback. |
| **Amplify build-time env vars** | Amplify frontend environment variables are not automatically exposed to the compute runtime. | Fetch secrets from **AWS SSM Parameter Store** (Standard tier is free) at runtime. |
| **PR previews & rebuilds** | Building on every commit/branch burns through free build minutes quickly. | Disable branch previews, use path filters, and run tests in GitHub Actions. |

---

## Part 2: The Production Blueprint (AWS Amplify Hosting, Lean)

### 1. Backend: Stateless & Clean Port Binding

Ensure your backend binds to `process.env.PORT` as a number and remains completely stateless (no local disk persistence, no long-lived WebSockets):

```javascript
// apps/api/src/server.js
import express from 'express';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

---

### 2. `deploy-manifest.json`

Place this in your repository root. It enforces clean routing, scopes immutable caching to `/assets/*`, and targets `nodejs22.x`:

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
      "path": "/assets/*",
      "target": {
        "kind": "Static",
        "cacheControl": "public, max-age=31536000, immutable"
      }
    },
    {
      "path": "/*.*",
      "target": {
        "kind": "Static"
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
      "runtime": "nodejs22.x",
      "entrypoint": "index.mjs"
    }
  ]
}
```

> **Key Rules**:
> 1. `/api/*` must come first.
> 2. Every target must declare a `"kind"`.
> 3. No Static-to-Static fallbacks.
> 4. Single-page client-side routing (e.g. refreshing `/dashboard` or `/settings`) is handled by adding a **200 Rewrite rule** to `/index.html` in the Amplify Console under **Rewrites and redirects**.

---

### 3. `scripts/build-amplify.sh` (Single-File Backend Bundle)

This script bundles your entire backend into a single `index.mjs` using `esbuild`. The build finishes in milliseconds, leaves out unnecessary `node_modules`, and reduces compute bundle size by >90%:

```bash
#!/usr/bin/env bash
set -euo pipefail

OUT=.amplify-hosting
rm -rf "$OUT" && mkdir -p "$OUT/static" "$OUT/compute/default"

# 1. Frontend build
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
```

*(Note: If you use native binary C++ modules like `sharp` or `bcrypt`, add `--external:sharp` to the `esbuild` command and install only those into `compute/default/`. Better yet, use pure-JS alternatives like `@node-rs/bcrypt`).*

---

### 4. `amplify.yml` (Cached Installs & Node 22)

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - nvm install 22 && nvm use 22
        - node -v
        - npm ci --cache .npm --prefer-offline
    build:
      commands:
        - bash scripts/build-amplify.sh
  artifacts:
    baseDirectory: .amplify-hosting
    files:
      - '**/*'
  cache:
    paths:
      - .npm/**/*
```

Also add an `.nvmrc` containing `22` and ensure `.amplify-hosting/` is listed in your `.gitignore`.

---

### 5. Secrets & Runtime Configuration

Amplify build-time environment variables are not automatically injected into the server compute runtime at request time. **Do not bake secrets into the bundle**.

1. **Store secrets in AWS Systems Manager (SSM) Parameter Store:**
   - Standard parameters are **100% free**.
   - Path format: `/my-app/prod/DATABASE_URL` (SecureString).
2. **Grant IAM Permissions:**
   - In AWS IAM, give your Amplify service role `ssm:GetParameter` permissions for your parameter path.
3. **Fetch Once at Startup:**
   ```javascript
   // Fetch once outside the request handler and cache in memory
   import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
   const ssm = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });

   let dbUrl;
   async function getDbUrl() {
     if (dbUrl) return dbUrl;
     const cmd = new GetParameterCommand({ Name: '/my-app/prod/DATABASE_URL', WithDecryption: true });
     const res = await ssm.send(cmd);
     dbUrl = res.Parameter.Value;
     return dbUrl;
   }
   ```

---

### 6. Amplify Cost Controls Checklist

- **Disable Branch / PR Previews:** In Amplify Console under **App settings** > **General**, ensure only your `main` branch is connected to avoid burning build minutes on every draft PR.
- **Use Path / Build-Skip Filters:** Add `[skip ci]` or configure path filters so docs/readme changes don’t trigger builds.
- **Run CI in GitHub Actions:** Run linters, unit tests, and type checks in GitHub Actions (2,000 free minutes/month). Let Amplify only execute the final build.
- **Cap CloudWatch Log Retention:** By default, CloudWatch retains logs forever. Go to the CloudWatch log group created for your Amplify app and set retention to **7 days** or **14 days**.

---

## Part 3: The Cheapest Option ($0.00/mo Forever) — S3 + CloudFront + Lambda Function URL

Amplify charges for build minutes ($0.01/min), data served ($0.15/GB), and SSR compute after 12 months.

For maximum cost efficiency, the following architecture runs at **effectively $0.00/month forever** under AWS Always-Free allowances:

```text
               [ Custom Domain / User ]
                          │
                          ▼
             [ Amazon CloudFront CDN ]
             (1 TB / mo free forever)
               │                  │
      /api/*   │                  │  /*
               ▼                  ▼
    [ Lambda Function URL ]   [ S3 Private Bucket ]
    (arm64, 256MB)            (Static HTML/CSS/JS)
    (1M req/mo free forever)  (Pennies / mo)
```

### Why It's Cheaper:
1. **CloudFront Always-Free Tier:** **1 TB data transfer out** and **10,000,000 HTTP/HTTPS requests** every month forever.
2. **Lambda Always-Free Tier:** **1,000,000 requests** and **400,000 GB-seconds** of compute every month forever.
3. **Lambda Function URLs:** **$0.00** (Zero API Gateway cost; CloudFront routes `/api/*` directly to the Function URL).
4. **Same-Origin / Zero CORS:** Both frontend and backend share your domain through CloudFront.
5. **Free CI/CD:** GitHub Actions provides 2,000 build minutes/month for free.

---

## Which Architecture Should You Choose?

| Goal | Pick This Option |
|---|---|
| **Fastest setup & Git-push automation with minimal AWS configuration** | **Improved Amplify Blueprint** (Part 2) |
| **Lowest possible long-term cost ($0.00/month forever) & complete infrastructure control** | **S3 + CloudFront + Lambda Function URL** (Part 3) |
