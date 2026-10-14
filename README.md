# Simple Full-Stack Monorepo

A lightweight, modern full-stack monorepo featuring a **Frontend (Vite + Vanilla JS/CSS)**, a **Backend (Express ESM REST API)**, and a **Shared Library (`@monorepo/shared`)** wired together with native **npm workspaces**.

---

## 🏗️ Architecture & Structure

```
monorepo/
├── apps/
│   ├── api/                   # Backend REST API Service
│   │   ├── package.json       # Dependencies: express, cors, @monorepo/shared
│   │   └── src/server.js      # Express server running on :4000
│   └── web/                   # Modern Frontend Web App
│       ├── package.json       # Dependencies: @monorepo/shared, vite
│       ├── vite.config.js     # Dev server (:3000) & /api proxy to :4000
│       ├── index.html         # Responsive, accessible dashboard UI
│       └── src/
│           ├── main.js        # Controller importing from @monorepo/shared
│           └── style.css      # Design system with dark/light themes
├── packages/
│   └── shared/                # Shared domain logic & contracts
│       ├── package.json       # Name: @monorepo/shared
│       └── src/index.js       # Models, validations, constants & helpers
├── package.json               # Root workspace configuration & unified scripts
└── README.md
```

---

## ⚡ Quick Start

### 1. Install Dependencies
Run from the root directory to install and link all workspace dependencies:
```bash
npm install
```

### 2. Start Development (Both Frontend & Backend)
A single command spins up both services concurrently with color-coded console output:
```bash
npm run dev
```

- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:4000](http://localhost:4000)
- **Health Check:** [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 🛠️ Individual Commands

| Command | Action |
| --- | --- |
| `npm run dev` | Runs both `@monorepo/api` and `@monorepo/web` in parallel |
| `npm run dev:api` | Runs backend only on port 4000 (`node --watch`) |
| `npm run dev:web` | Runs frontend only on port 3000 (`vite`) |
| `npm run build` | Builds all packages and web app for production |
| `npm run start` | Starts backend production server |
| `npm run clean` | Cleans all `node_modules` and `dist` build artifacts |

---

## 🔗 How Package Sharing Works

1. **Root `package.json`** declares the workspace globs:
   ```json
   "workspaces": [
     "apps/*",
     "packages/*"
   ]
   ```

2. **`packages/shared`** exports domain constants, types, and input validators.

3. **`apps/api`** and **`apps/web`** depend on `"@monorepo/shared": "*"`:
   ```javascript
   // Both apps can directly import:
   import { validateItemPayload, ITEM_STATUS } from '@monorepo/shared';
   ```

4. **Zero build step required for local dev**: With ES Modules (`"type": "module"`), both Node and Vite consume shared code directly and hot-reload changes instantly.

---

## 🧪 Features Included

- **Shared Domain Validation:** Data validation happens using the exact same function on both frontend and backend.
- **Live Health Status & Latency Ping:** The UI actively monitors the API connection and shows real-time ping.
- **RESTful Endpoints:** Complete CRUD for workspace items (`GET /api/items`, `POST /api/items`, `PATCH /api/items/:id`, `DELETE /api/items/:id`).
- **Interactive UI:** Filtering, status toggle, dynamic statistics cards, and theme switcher (Dark/Light).
