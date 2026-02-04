# Orcratration — Infrastructure notes

## Architecture overview

- **Frontend (React + Vite):** Form builder, script editor (Monaco), deploy button, admin UI. Talks to Backend API.
- **Backend (Node + Hono):** Persists forms/scripts/deployments in MongoDB, orchestrates deploy (calls Deployer), auth, session/session state API.
- **Deployer:** Validates and bundles user script with worker-template (esbuild), uploads Worker via Cloudflare API, creates route. Used by Backend.
- **Worker (Cloudflare):** One Worker per script (or per form-script bundle). Receives POST with `session_id`, `formId`, `event`, `formData`; runs user script with `ctx`/`hook`; uses KV (or Durable Object) for store.

## Data stores

- **MongoDB:** Canonical store for form definitions, scripts, deployments, users, audit.
- **Cloudflare KV / Durable Object:** Runtime store for script `ctx.store` (session-scoped; key prefix `ORCR_SESSION::{session_id}::`).

## Deployment pipeline (target)

1. User clicks Deploy in UI → `POST /api/forms/:id/deploy`.
2. Backend validates, creates Deployment record (status `queued`), calls Deployer.
3. Deployer: for each script, bundle with worker-template, upload via Cloudflare API, create/update route.
4. Backend updates Deployment status to `active` (or `failed`), returns result to frontend.

## Security

- Script sandbox: no Node globals; optional fetch allow-list; no `eval` with user scope; lint/scan for forbidden tokens.
- Secrets: Cloudflare Worker env bindings; do not expose plain text to script authors.
- Rate limiting on Worker and Backend endpoints (per-form / per-account).

## Observability

- Cloudflare Logs for Workers; optional forward to Sentry/Datadog.
- Backend: store execution metadata in Mongo (scriptId, session_id, success/fail, latency).
- Admin dashboard: deployment list, script execution counts, error rates.

## Scaling

- Prefer one Worker per script for isolation; optionally bundle multiple scripts per form to reduce cross-worker calls.
- Durable Object sharding by `session_id` for per-session state.
- MongoDB and Cloudflare scale independently; consider connection pooling and Worker CPU/time limits.
