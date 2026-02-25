# Cloudflare Workers Adaptation Guide

This is a fork of [shopify/shopify-app-template-react-router](https://github.com/Shopify/shopify-app-template-react-router) adapted to run on Cloudflare Workers with a D1 database instead of Node.js + SQLite/Prisma.

## First-Time Setup

```bash
# 1. Create your D1 database
npx wrangler d1 create shopify-app-db
# Paste the returned database_id into wrangler.jsonc

# 2. Install dependencies (also runs cf-typegen to generate env.d.ts)
npm install

# 3. Apply D1 migrations to local dev database
npx wrangler d1 migrations apply shopify-app-db --local

# 4. Start dev server (or use: shopify app dev)
npm run dev
```

## Deploy

```bash
# Set production secrets (one-time)
wrangler secret put SHOPIFY_API_SECRET
wrangler secret put SHOPIFY_API_KEY

# Apply migrations to production D1
npx wrangler d1 migrations apply shopify-app-db

# Deploy
npm run deploy:workers
```

---

## Files That Diverge From Upstream

When pulling updates from [shopify/shopify-app-template-react-router](https://github.com/Shopify/shopify-app-template-react-router), these files need manual attention:

### `package.json` — HIGH conflict risk

**What changed:** Removed Node/Prisma packages; added Cloudflare packages.

| Removed | Added |
|---------|-------|
| `@prisma/client` | `@cloudflare/workers-types` |
| `prisma` | `wrangler` (devDep) |
| `@react-router/node` | `@cloudflare/vite-plugin` (devDep) |
| `@react-router/serve` | |
| `@shopify/shopify-app-session-storage-prisma` | |

**Removed scripts:** `start`, `docker-start`, `setup`, `prisma`
**Added scripts:** `cf-typegen`, `deploy:workers`, `dev:local`, `postinstall`

**Merge strategy:** When upstream bumps a shared package version (e.g. `@shopify/shopify-app-react-router`, `react`, `react-router`), manually adopt that version bump. Do not re-add the removed packages.

---

### `app/shopify.server.ts` — MEDIUM-HIGH conflict risk

**What changed:** Complete rewrite.
- Removed: Node adapter import, `PrismaSessionStorage`
- Added: `D1SessionStorage` class, lazy `getShopifyApp()` init, `setupShopify(env)` export
- All public exports remain identical to upstream: `authenticate`, `unauthenticated`, `login`, `registerWebhooks`, `addDocumentResponseHeaders`, `apiVersion`

**Merge strategy:** When upstream changes `shopify.server.ts`, look for:
1. **API version bumps** (`ApiVersion.OctoberXX`) — apply to both `getShopifyApp()` and the `apiVersion` export
2. **New `shopifyApp()` options** — add them inside `getShopifyApp()`
3. **New exports** — mirror the pattern of the existing lazy-init exports

---

### `app/entry.server.tsx` — MEDIUM conflict risk

**What changed:** Replaced Node-specific `renderToPipeableStream` + `PassThrough` streams with `renderToReadableStream` (Web Streams API, native to CF Workers).

**Merge strategy:** When upstream changes `entry.server.tsx`, check if changes are to the streaming logic or to the handler signature. The handler signature (`handleRequest(request, statusCode, headers, routerContext, loadContext)`) should stay the same. Port any non-streaming logic changes (new error handling, new headers, etc.) to the `renderToReadableStream` version.

---

### `vite.config.ts` — LOW conflict risk

**What changed:** Added `cloudflare()` plugin and its env-injection config callback. Everything else (HMR config, server port, CORS, optimizeDeps) is identical to upstream.

**Merge strategy:** When upstream changes `vite.config.ts`, apply those changes. The only CF-specific block to preserve is the `cloudflare({ ... })` plugin entry in the `plugins` array.

---

### `tsconfig.json` — LOW conflict risk

**What changed:** Removed `"@react-router/node"` from `types`. CF worker types come from the generated `env.d.ts` (via `npm run cf-typegen`).

**Merge strategy:** If upstream adds new entries to `types`, add them here too (but do not re-add `@react-router/node`).

---

### `shopify.web.toml` — LOW conflict risk

**What changed:** Replaced `prisma generate` / `prisma migrate deploy` commands with `wrangler types` / `wrangler d1 migrations apply`. Added `port = 5173`.

**Merge strategy:** If upstream changes other fields in this file, apply them. Preserve the `predev` and `dev` commands.

---

## Files Added (No Upstream Conflict)

These files don't exist upstream, so they'll never conflict:

| File | Purpose |
|------|---------|
| `wrangler.jsonc` | Cloudflare Worker + D1 config |
| `workers/app.ts` | CF fetch handler entry point |
| `migrations/` | D1 SQL migrations (replaces `prisma/migrations/`) |
| `react-router.config.ts` | Enables CF Vite plugin SSR compatibility |
| `.dev.vars.example` | Template for local CF env vars |
| `tsconfig.node.json` | Node types for `vite.config.ts` (keeps CF + Node types separate) |

## Files Removed vs Upstream

| File | Reason |
|------|--------|
| `Dockerfile` | CF Workers deploys via Wrangler, not Docker |
| `.dockerignore` | Same |
| `prisma/` | Replaced by `migrations/` + D1 |

---

## Route Files Are Unchanged

All files under `app/routes/` are **identical to upstream** and will auto-merge cleanly. The Shopify auth pattern (`authenticate.admin(request)`) works the same — it just hits `D1SessionStorage` instead of Prisma under the hood.
