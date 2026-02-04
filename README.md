# Orcratration

**Cloudflare Workers–powered Typeform alternative.** Design dynamic multi-page forms and attach JavaScript scripts that run on Cloudflare Workers to extend and orchestrate form behaviour.

- **Creator:** Design forms (fields, types, validation), attach named scripts to events (preload, validate, submit), then Deploy.
- **End-user:** Open a public form link, fill inputs across pages; scripts run in the background to fetch data, set store values, validate, and affect flow (skip page / set errors / redirect).
- **Tech:** TypeScript, React + Vite, MongoDB, Cloudflare Workers, Hono.

## Monorepo (pnpm + Turbo)

| Package              | Description                                      |
|----------------------|--------------------------------------------------|
| `packages/shared`    | Script runtime types (`Ctx`, `Hook`), form/script entity types |
| `packages/worker-template` | Cloudflare Worker runtime wrapper (Hono + ctx/hook, KV store) |
| `packages/deployer`  | Bundle user script + deploy to Cloudflare API     |
| `packages/backend`   | Hono API, MongoDB (forms, scripts, deployments), auth stub |
| `packages/frontend`  | React + Vite app (form builder, script editor, deploy UI) |

## Quick start

```bash
pnpm install
pnpm build          # build all packages
pnpm dev:backend    # backend on :3000 (needs MongoDB)
pnpm dev:frontend   # frontend on :5173
pnpm dev:worker     # worker-template local dev (wrangler dev)
```

### Worker Loader (dynamic isolates)

You can run user scripts via the [Cloudflare Worker Loader](https://developers.cloudflare.com/workers/runtime-apis/bindings/worker-loader/) so one deployed Worker loads arbitrary scripts in dynamic isolates at runtime (no per-script deploy). This is in **closed beta** on Cloudflare; it works locally with Wrangler.

```bash
pnpm --filter worker-template dev:loader   # loader orchestrator (uses LOADER binding)
```

See [docs/worker-loader.md](docs/worker-loader.md) for request format and backend integration.

### Environment

Use a single **`.env`** at the project root. Copy `.env.example` to `.env` and set values.

- **Backend** loads root `.env` automatically (via `dotenv`). Used: `MONGODB_URI`, `PORT`, `JWT_SECRET`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `KV_NAMESPACE_ID`.
- **Frontend** (Vite) loads from the same root `.env`; use a `VITE_` prefix for any var you need in the client.
- **Root scripts** (`dev:backend`, `dev:frontend`, `dev:worker`) inject root `.env` via `dotenv-cli`, so running from root applies the same file everywhere.

## Script runtime

Scripts export:

```js
exports.execute = async (ctx, hook) => { ... }
```

- **ctx:** `session_id`, `formId`, `pageId`, `formData`, `forms`, `store` (read-only), `env`.
- **hook:** `setStoreData`, `getStoreData`, `setError`, `setFieldError`, `setRedirect`, `setResponse`, `log`.

See `packages/shared/src/script-runtime.ts` and `examples/user-script.js`.

## Roadmap

- **M0 (MVP):** Form builder UI, script editor, backend persistence, deploy (bundle + Cloudflare API), runtime wrapper + KV, basic admin.
- **M1:** Durable Object store, dry-run/test runner, security scanning, observability.
- **M2:** Multi-script ordering, secrets manager, rate limits, SDK helpers.
- **M3:** Multi-account, RBAC, audit, billing.

## License

Proprietary / as specified by project owner.
