# Orcratration + Cloudflare Worker Loader

Orcratration runs user scripts in two modes:

1. **Worker Loader (default)** — A single **orchestrator** Worker uses the [Dynamic Worker Loader](https://developers.cloudflare.com/workers/runtime-apis/bindings/worker-loader/) binding to run scripts in **dynamic isolates** at runtime. No per-script deploy; the backend POSTs `scriptId` + `scriptSource` to the loader on each submit. **Works in local dev** (Wrangler/workerd) without signing up for beta.

2. **One Worker per script** — Deployer bundles each script with the runtime and uploads a separate Worker via the Cloudflare API. Enable by leaving `LOADER_URL` unset and configuring Cloudflare credentials.

## Default: Worker Loader (run locally)

Worker Loader is the **default**. You don’t need to sign up for the Cloudflare beta to use it locally.

1. **Start the loader** (from repo root):
   ```bash
   pnpm --filter @orcratration/worker-template dev:loader
   ```
   This runs the orchestrator at `http://localhost:8787` with the `LOADER` binding.

2. **Point the backend at the loader** in `.env`:
   ```env
   LOADER_URL=http://localhost:8787
   ```

3. **Start the backend** (and frontend). On form submit, the backend will POST to the loader with script id and bundled source; no per-script Cloudflare deploy is needed.

4. **Deploy** in the UI is a no-op when `LOADER_URL` is set: scripts are run on demand by the loader.

## Production (Worker Loader on Cloudflare)

The Worker Loader API on Cloudflare’s edge is in **closed beta**. To run the loader in production:

1. [Sign up for the beta](https://forms.gle/MoeDxE9wNiqdf8ri9).
2. Deploy the loader worker once: `pnpm --filter @orcratration/worker-template deploy:loader` (uses `wrangler.loader.toml`).
3. Set `LOADER_URL` to the deployed worker URL (e.g. `https://orcratration-loader.<subdomain>.workers.dev`).

## One Worker per script (optional)

If you prefer not to use the loader:

1. Leave `LOADER_URL` unset in `.env`.
2. Set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and optionally `KV_NAMESPACE_ID`.
3. Use **Deploy** in the app to upload one Worker per script; the backend will call those Worker URLs on submit.

## Request format (loader entrypoint)

`POST /` with JSON body:

```json
{
  "scriptId": "my-script",
  "scriptSource": "export const execute = async (ctx, hook) => { hook.log('info', 'Hi'); };",
  "session_id": "sess-123",
  "formId": "form-1",
  "event": "onSubmit",
  "formData": {},
  "forms": []
}
```

- **scriptId** — Loader cache id; same id + same code ⇒ isolate reuse.
- **scriptSource** — ESM that exports `execute(ctx, hook)` (backend bundles raw script source before sending).
- Other fields are the execution payload for the dynamic worker.

## Form renderer (end-user)

Public form filling follows the form **flow** (pages + script steps):

- **URL:** `/fill/:slug` (e.g. `/fill/my-form`).
- Form is loaded by slug; flow is `form.flow` or derived from pages + scripts.
- User moves through page steps (fill fields → Next) and script steps run automatically between pages; final step submits with `onSubmit` and shows a completion message.

No auth is required for `/fill/:slug` or for `POST /api/submit`.

## Stateless vs stateful

| What | Where it lives | Stateful? |
|------|----------------|-----------|
| **Form flow** (current step, formData, “Next” progress) | Frontend only (React state) | **No** — backend and loader do not store it. Refreshing the page loses progress. |
| **Backend** | No server-side session for the flow | **Stateless** — each request is independent; it just forwards to the loader. |
| **Script session store** (`ctx.store` / `hook.setStoreData`) | Loader’s dynamic worker: KV or in-memory | **Yes when KV is set** — data keyed by `session_id` persists across requests (e.g. prefill, multi-step scripts). **No when KV is not set** (e.g. local dev) — in-memory store is per request, so script store does not persist. |

So overall: **flow is stateless** (client-only); **script-visible session data is stateful only if KV is configured** for the loader worker.
