# Orcratration — Infrastructure notes

## Architecture

- **Public player (`packages/form`):** Next.js. One field per screen. Calls `POST /api/run` and `routeScriptResult`.
- **Creator (`packages/frontend`):** Vite. Deploy publishes each flow script to the platform. It does not change `Form.runtime` and it does not call Cloudflare.
- **Admin (`/admin`):** Vite night desk. Binds a script to Cloudflare (`loader` or `worker`) and switches `Form.runtime`. Lists platform sessions from `session_stores`. Does not call `GET /api/deployments`. The player link uses `VITE_PLAYER_ORIGIN`, default `http://localhost:4000`.
- **Backend:** Hono and MongoDB. Compiles a script, stores a revision, and runs the active binding.
- **Deployer:** esbuild. Author ESM becomes an ESM bundle (Cloudflare) and a CJS bundle (platform `node:vm`).
- **Worker template:** Optional Cloudflare target. Loader mode or one worker per script. Both return `RunResult`.

## Data

- **MongoDB:** forms, scripts, revisions, bindings, users, and platform session stores (`session_stores`).
- **Old `deployments` collection:** frozen. `GET /api/deployments` still reads it. New publishes do not write it.
- **Cloudflare KV:** only for a Cloudflare binding published while `KV_NAMESPACE_ID` is set. Keys use `ORCR_SESSION::<session_id>::`.

## Publish and run

1. `POST /api/scripts/:id/publish` compiles the draft. Failure is `422 publish_failed` and leaves the previous platform binding active.
2. Success inserts a revision and upserts the platform binding (`storeDurable: true`).
3. `POST /api/run` runs that one script step. The response is one `RunResult`.
4. `POST /api/scripts/:id/bindings/cloudflare` adds the optional Cloudflare binding.
5. `PATCH /api/forms/:id/runtime` selects which binding is live. `platform` is the default.

There is no fetch allow-list, no secrets manager, and no Durable Objects in this slice. `ctx.env` is `script.env` only.

## Removed routes

`POST /api/submit`, `POST /api/forms/:id/deploy`, and `POST /api/scripts/:id/deploy` are gone.
