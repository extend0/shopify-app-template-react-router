# Shopify App Template (React Router + Cloudflare Workers)

This repository is a Cloudflare Workers + D1 fork of the Shopify React Router app template.

It keeps the Shopify app auth and embedded app flow from the upstream template, but replaces the Node/Prisma runtime stack with:

- Cloudflare Workers for runtime and deploys
- Cloudflare D1 for session storage
- Wrangler for Worker deployment and D1 migrations
- npm as the standard package manager (lockfile committed)

Upstream template: https://github.com/Shopify/shopify-app-template-react-router

## What Is Different From Upstream

- No Prisma or SQLite
- No Docker-based deployment setup
- Session storage is implemented in `app/shopify.server.ts` using D1
- Worker entrypoint is `workers/app.ts`
- Migrations live in `migrations/`
- CI and scripts are npm-only

For maintainer notes about upstream merge conflicts and fork-specific files, see `CLOUDFLARE.md`.

## Prerequisites

- Node.js `>=20.19 <22 || >=22.12`
- npm (repo is pinned to `npm@11.8.0`)
- Shopify CLI
- Cloudflare account + Wrangler access

Useful docs:

- Shopify CLI: https://shopify.dev/docs/apps/tools/cli/getting-started
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare D1: https://developers.cloudflare.com/d1/

## First-Time Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a D1 database

```bash
npx wrangler d1 create shopify-app-db
```

Copy the returned `database_id` into `wrangler.jsonc`.

### 3. Apply local D1 migrations

```bash
npx wrangler d1 migrations apply shopify-app-db --local
```

### 4. Start local development

```bash
npm run dev
```

This uses `shopify app dev` (tunnel, app config sync, Shopify env injection).

Optional: if you want to run the React Router dev server directly (without `shopify app dev`), copy `.dev.vars.example` to `.dev.vars` and fill in the required values.

## Local Development

### Recommended (Shopify CLI + tunnel)

```bash
npm run dev
```

### React Router dev server only

```bash
npm run dev:local
```

### Validation

```bash
npm run check
```

`check` runs:

- type generation (`wrangler types` + `react-router typegen`)
- TypeScript checks
- ESLint

## Scripts

Common scripts in `package.json`:

- `npm run dev` - Shopify CLI development flow
- `npm run dev:local` - React Router dev server only
- `npm run build` - production build (client + Worker SSR bundle)
- `npm run typegen` - Cloudflare and React Router type generation
- `npm run typecheck` - TypeScript checks (read-only)
- `npm run lint` - ESLint
- `npm run check` - typegen + typecheck + lint
- `npm run deploy:worker` - build + `wrangler deploy`
- `npm run deploy:shopify` - `shopify app deploy` (sync app config/webhooks)
- `npm run deploy:all` - deploy Shopify config, then deploy Worker

## Deploying To Cloudflare Workers

### One-time production setup

Set production secrets in Cloudflare (examples):

```bash
wrangler secret put SHOPIFY_API_KEY
wrangler secret put SHOPIFY_API_SECRET
```

If needed, also configure non-secret vars in `wrangler.jsonc` / deploy config (for example `SHOPIFY_APP_URL`, `SCOPES`, `SHOP_CUSTOM_DOMAIN`).

Apply D1 migrations to production:

```bash
npx wrangler d1 migrations apply shopify-app-db
```

### Deploy commands

Deploy the Worker runtime:

```bash
npm run deploy:worker
```

Sync Shopify app configuration/webhooks:

```bash
npm run deploy:shopify
```

Run both (Shopify config first, Worker second):

```bash
npm run deploy:all
```

## Storage (D1)

This fork uses Cloudflare D1 for Shopify session storage.

- Session storage implementation: `app/shopify.server.ts`
- Worker request entrypoint: `workers/app.ts`
- SQL migrations: `migrations/`

## Troubleshooting

### D1 tables do not exist

If you see a database table error locally, apply local migrations again:

```bash
npx wrangler d1 migrations apply shopify-app-db --local
```

For production, apply migrations without `--local`.

### Navigating or redirecting breaks an embedded app

Embedded apps must preserve the session inside an iframe. To avoid issues:

1. Use `Link` from `react-router` or `@shopify/polaris` instead of `<a>`.
2. Use `redirect` returned from `authenticate.admin`, not `redirect` from `react-router`.
3. Use `useSubmit` from `react-router`.

### Webhooks: shop-specific subscriptions are not updated

If you register webhooks in `afterAuth`, subscriptions may not update reliably during normal development.

Prefer app-specific webhook subscriptions in `shopify.app.toml`. Shopify syncs these when you run `shopify app deploy` (for example `npm run deploy:shopify`).

References:

1. https://shopify.dev/docs/apps/build/webhooks/subscribe#app-specific-subscriptions
2. https://shopify.dev/docs/apps/build/webhooks/subscribe/get-started?deliveryMethod=https

### Webhooks triggered by Shopify CLI have no `admin`

When the Shopify CLI triggers a webhook event, the `admin` object can be `undefined`. The CLI uses a valid but non-existent shop for testing. This is expected.

### Streaming responses during local development

The Shopify CLI uses a Cloudflare tunnel by default. Tunnels can buffer streamed responses until completion, so local streaming behavior may differ from production.

If you are testing streaming (`Await` / deferred responses), prefer localhost-based development.

### `nbf` claim timestamp check failed

This usually means a JWT token is expired or your system clock is out of sync. Make sure your system time is set automatically.

## Resources

- Shopify App React Router docs: https://shopify.dev/docs/api/shopify-app-react-router
- Shopify app getting started: https://shopify.dev/docs/apps/getting-started
- Shopify CLI docs: https://shopify.dev/docs/apps/tools/cli
- Cloudflare Workers docs: https://developers.cloudflare.com/workers/
- Cloudflare D1 docs: https://developers.cloudflare.com/d1/
- React Router docs: https://reactrouter.com/home
