# Execution contract

Orcratration runs user scripts from our own API. Cloudflare is an optional second publish target. A form has one active runtime. `POST /api/run` executes one flow step and returns one `RunResult`.

This slice replaces the execute and publish contracts. It does not redesign the creator UI.

## Problem

The product treats deployment as a Cloudflare upload.

- `POST /api/submit` runs every script on a form event. The flow step that is actually showing is ignored. The client does not send `scriptId` or `stepId`.
- The worker, the loader, and the in-process executor return different JSON shapes. `setError` becomes an HTTP status. `setResponse` replaces the body. `setRedirect` becomes `c.redirect`. `setOutputNode` is missing from the loader wrapper. The fillers only read `outputNode` and `error`.
- Two script dialects are in the tree. The example and `bundleScript` assume `exports.execute`. The local executor assumes `export async function execute`.
- With no Cloudflare credentials, submit falls through to an in-process `eval` whose session store is a new `Map` on every call. That path is a fallback, not a runtime.
- `Deployment` requires `workerName`. Loader mode returns a fake deployment id and writes nothing. `POST /api/scripts/:id/deploy` still calls Cloudflare when `LOADER_URL` is set.
- The loader passes worker bindings into `ctx.env` and sets `globalOutbound: null`, so a script cannot `fetch` and can see the KV binding.
- Form versions snapshot pages and scripts and drop `flow`.

## Locked decisions

1. The first slice is the execution contract. Creator UI work comes later.
2. The non-Cloudflare runtime is our API. It runs the same `execute(ctx, hook)` source. Cloudflare is never required.
3. One run API, one active runtime per form. Publishing always activates the platform binding. Cloudflare is a second binding. The form chooses which binding is live.
4. `POST /api/run` runs one script step. The response is one `RunResult`.
5. When a runtime actually ran the script, the HTTP status is 200, including `setError`, thrown exceptions, and timeouts. 4xx and 502 are platform failures.
6. Hook method names stay: `setStoreData`, `getStoreData`, `setError`, `setFieldError`, `setRedirect`, `setResponse`, `setOutputNode`, `log`.
7. `POST /api/submit`, `POST /api/forms/:id/deploy`, and `POST /api/scripts/:id/deploy` are removed.
8. Publish compiles the draft. A failed compile writes nothing and leaves the previous platform binding active.
9. Switching a form to Cloudflare is rejected until every script step has an active Cloudflare binding.
10. Platform session data lives in Mongo. It is not copied to KV. Each runtime has its own store.
11. The platform sandbox may call `fetch`. It is not a security boundary against the script author.
12. Both existing fillers call `/api/run` and follow `RunResult`. No visual redesign in this slice.

## Non-goals

- A new creator UI. No Monaco, no runtime picker, no new publish screen. The existing Deploy buttons are rewired onto the new endpoints and still show the JSON response. Admin keeps listing old `Deployment` rows only. Cloudflare binding and the runtime switch are API-only until the UX slice.
- Authentication, ownership, and RBAC. Publish and run stay open, matching the rest of the API today.
- A secrets manager. `script.env` is a plain JSON object. `GET /api/scripts/:id` returns it. Process env and worker bindings are never copied into `ctx.env`.
- Deleting `packages/form` or merging the two fillers.
- Durable Objects, fetch allow-lists, and a hard isolate around the platform runtime.
- Migrating old `Deployment` rows into bindings. The collection is frozen. `GET /api/deployments` keeps returning old rows. New publishes do not write it.
- Sharing or migrating session data when a form changes runtime.

## Author script

One module, one file, ESM:

```js
export async function execute(ctx, hook) {
  hook.setOutputNode("ok");
}
```

`export function execute` is also valid. `exports.execute` is not. Top-level `import` of a package or a relative file fails publish. Top-level code runs once at publish, to confirm `execute` is a function, and again on each run. Publish spends the same timeout as a run (`SCRIPT_TIMEOUT_MS`, default 30000). A hang or a throw at publish is `422 publish_failed`. Publish does not call `execute`.

`ctx` keeps `session_id`, `formId`, `pageId`, `formData`, `forms`, `store`, and `env`. It gains `event` and `stepId`. The HTTP body uses `sessionId`. The server maps it to `ctx.session_id`.

`ctx.forms` is built by the server from the stored form: `[{ id, name, pages }]`. The client does not supply it.

`ctx.env` is `script.env` or `{}`.

`ctx.store.get` and `hook.getStoreData` read the active runtime's store. `hook.setStoreData` writes it. Values are JSON values. Keys match `^[A-Za-z_][A-Za-z0-9_]{0,127}$`. Any other key makes `setStoreData` reject with `invalid_store_key`. A script that does not catch that rejection fails the run as `script_threw`.

## Run

`POST /api/run`

```json
{
  "sessionId": "sess-1",
  "formId": "…",
  "stepId": "…",
  "scriptId": "…",
  "event": "onSubmit",
  "pageId": "page-1",
  "formData": { "page-1": { "email": "a@b.co" } }
}
```

Required: `sessionId`, `formId`, `stepId`, `scriptId`, `event`, `formData`. `pageId` is optional. `event` is `onLoad`, `onValidate`, `onSubmit`, or `onPageChange`. `formData` is an object whose values are objects. Ids are compared as strings. A populated `scriptId` object uses its `_id`.

The server loads the form, finds `stepId`, and checks all of the following:

- The step exists and `type` is `script`.
- `step.scriptId` equals `scriptId`.
- The form's runtime has an active binding for that script.

It then runs that revision and returns `RunResult`.

```ts
interface RunResult {
  ok: boolean;
  outputNode?: string;
  fieldErrors: Array<{ formId: string; field: string; message: string }>;
  error?: { status: number; errorKey: string; message?: string };
  redirect?: { url: string; status: number };
  response?: { status: number; body: unknown };
  logs: Array<{ level: "debug" | "info" | "warn" | "error"; message: string }>;
}
```

Mapping from the hook, in this order after `execute` returns:

| Hook | Result |
|---|---|
| `setFieldError` | Append `{ formId, field, message }`. Does not change `ok`. |
| `setOutputNode` | `outputNode` is the last name set. |
| `log` | Append to `logs`. |
| `setError` | `ok: false`, `error: { status, errorKey, message }`. |
| `setRedirect` | `redirect`. Default status 302. |
| `setResponse` | `response: { status, body }` where `body` is the payload. Default status 200. |
| none of the three above, and no throw | `ok: true`. |

`setError`, `setRedirect`, and `setResponse` can all be present. The server does not drop any of them and does not turn them into a special HTTP status or a redirect response.

A thrown exception:

```json
{ "ok": false, "error": { "status": 500, "errorKey": "script_threw", "message": "…" }, "fieldErrors": [], "logs": [] }
```

HTTP 200. Field errors and logs collected before the throw are kept. `outputNode` is kept if it was set.

A platform timeout uses `errorKey: "script_timeout"` and `status: 408`, HTTP 200.

`logs` keeps the first 100 entries. Each message is cut at 2000 characters. Further logs are dropped.

Platform HTTP errors, not `RunResult`:

| Condition | Status | `error` |
|---|---|---|
| Missing or invalid body, or unknown `event` | 400 | `invalid_body` |
| Unknown form | 404 | `form_not_found` |
| Unknown step | 404 | `step_not_found` |
| Step is not a script step | 409 | `step_not_script` |
| Step's script id does not match | 409 | `script_mismatch` |
| No active binding for the form runtime | 409 | `binding_missing` |
| Cloudflare fetch failed | 502 | `runtime_unavailable` |
| Cloudflare responded with a non-result | 502 | `runtime_bad_response` |

`binding_missing` includes `runtime` and `scriptId`. `runtime_unavailable` and `runtime_bad_response` include `message`.

A saved draft does not run. The author publishes first. There is no silent local fallback.

## Routing a result

`routeScriptResult(step, result)` in `@orcratration/shared` is the only routing rule. Both fillers call it. A non-200 from `/api/run` does not go through it. The filler shows a failure outcome with the platform `message`.

```ts
type ScriptRoute =
  | { type: "redirect"; url: string; status: number }
  | { type: "step"; stepId: string; fieldErrors: RunResult["fieldErrors"] }
  | { type: "outcome"; outcome: "success" | "failure"; message?: string; fieldErrors: RunResult["fieldErrors"] };
```

Order:

1. `result.redirect` is a redirect. It wins over `outputNode` and `ok`.
2. `result.outputNode` that matches `step.outputTargets` goes to that step.
3. `result.outputNode` that matches nothing is a failure outcome, message `Unknown output "<name>"`.
4. `ok: false` with no matching output is a failure outcome. `error.message` is the message.
5. `ok: true`, no `outputNode`, and exactly one key in `outputTargets` goes to that step.
6. `ok: true`, no `outputNode`, and no keys in `outputTargets` is a success outcome.
7. `ok: true`, no `outputNode`, and more than one key in `outputTargets` is a failure outcome, message `Script did not choose an output`.

A missing `outputTargets` has no keys. `outputs` names that are not keys of `outputTargets` are ignored.

Field errors travel on the route. When the next step is a page, that page shows a message under each field whose `name` matches `field`. Unmatched messages render as a list above the fields. An outcome screen lists them under the outcome message. The filler does not invent a back edge. An author who wants the user to return to a page wires an output to that page.

## Publish and bindings

A script has a draft (`Script.source`, `Script.env`) and immutable revisions.

`POST /api/scripts/:id/publish`

Optional body `{ "source": "…", "env": {} }`. When `source` or `env` is present, the server saves it onto the draft first, then compiles the draft. When the body is empty, it compiles the stored draft.

Compile uses `bundleScript`, which returns two strings from one esbuild build: `esm` (what the loader and the worker upload consume) and `cjs` (what the platform vm runs). The publish check runs the CJS inside the same vm runner used at run time, with the run timeout, and reads `module.exports.execute`. It does not call `execute`. Top-level code therefore runs at publish inside the vm.

On failure, including a timeout or a throw while loading the module, the response is `422`:

```json
{ "error": "publish_failed", "message": "…" }
```

No revision is written. No binding changes.

On success the server writes a `Revision` and sets the platform live binding to that revision in one `findOneAndUpdate` upsert. When a live row already exists, its previous fields are appended to `history` as `superseded`. The first publish starts with an empty `history`. The response is `201`:

```json
{
  "revision": { "id": "…", "version": 3, "sourceSha": "…" },
  "binding": {
    "id": "…",
    "runtime": "platform",
    "status": "active",
    "revisionId": "…",
    "storeDurable": true,
    "publishedAt": "…"
  }
}
```

Publishing the same source again creates a new revision. Versions start at 1 and increase by 1 per successful compile, including a compile whose binding upsert then fails. If that upsert throws, the response is `500` `{ "error": "publish_failed", "message": "…" }`. The new revision stays in the collection and is not live. The previous live binding stays as it was.

`POST /api/scripts/:id/bindings/cloudflare`

```json
{ "mode": "loader", "revisionId": "optional" }
```

`mode` is `loader` or `worker`. `revisionId` defaults to the revision pointed at by the active platform binding. If the script has no platform revision, the response is `409`:

```json
{ "error": "revision_required", "message": "Publish the script before binding Cloudflare" }
```

`loader` requires `LOADER_URL`. The server does not call the loader during publish. The binding `target` is that URL. `worker` requires `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, bundles the revision's ESM with the worker template, and uploads it. The worker name is `orcratration-` plus the script id with every character outside `[A-Za-z0-9-_]` replaced by `-`, then sliced to 32 characters. `target` is `https://<workerName>.workers.dev`.

Unknown script id on publish or on either binding route is `404` `{ "error": "script_not_found" }`. A missing or unknown `mode` is `400` `{ "error": "invalid_body" }`. A `revisionId` that is not a revision of this script is `404` `{ "error": "revision_not_found" }`.

Missing configuration for the chosen mode is `422`:

```json
{ "error": "runtime_not_configured", "message": "…" }
```

No binding row is written.

An upload or bundle failure does not change a live `active` Cloudflare binding. It appends a `failed` history entry for the revision that failed. When no Cloudflare row exists yet, it upserts a live row with `status: "failed"`. That row is not usable. The response is `502`:

```json
{
  "error": "cloudflare_publish_failed",
  "message": "…",
  "binding": { "runtime": "cloudflare", "status": "active" }
}
```

`binding` is the live row after the call. `status` stays `active` when a previous publish had succeeded. It is `failed` when this was the first attempt. `binding` is `null` only when the failure happened before any row was written, which this path does not do.

A successful Cloudflare publish upserts the live Cloudflare row onto the new revision, appends the previous live fields to `history` as `superseded`, and returns `201` with the binding. `storeDurable` is true only when `KV_NAMESPACE_ID` is set at publish time. Adding KV later requires another Cloudflare publish.

`GET /api/scripts/:id/bindings` returns the live row for each runtime that has one. Each row includes `history`, newest first.

`GET /api/scripts/:id` includes the draft, `env`, the latest revision summary, and the live binding for each runtime. A live row with `status: "failed"` is included and is not usable by `/api/run`.

## Form runtime

`Form.runtime` is `platform` or `cloudflare`. Missing values, including existing documents, are `platform`.

`PATCH /api/forms/:id/runtime`

```json
{ "runtime": "platform" }
```

Switching to `platform` always succeeds.

Switching to `cloudflare` looks only at `form.flow` steps with `type: "script"`. Every such step needs an active Cloudflare binding for its `scriptId`. A step with no `scriptId` counts as blocked. The legacy `scripts` array is ignored. A form with no script steps can switch.

Blocked:

```json
{
  "error": "runtime_switch_blocked",
  "message": "Every script step needs an active Cloudflare binding",
  "scriptIds": ["…"],
  "stepIds": ["…"]
}
```

Status `409`. `Form.runtime` stays unchanged. An unknown form is `404` `{ "error": "form_not_found" }`. A body whose `runtime` is neither `platform` nor `cloudflare` is `400` `{ "error": "invalid_body" }`.

Success returns `{ "runtime": "platform" | "cloudflare" }`.

`POST /api/forms/:id/versions` snapshots `name`, `slug`, `pages`, `scripts`, `flow`, and `runtime`.

## Session store

Platform store collection `session_stores`:

```ts
{ sessionId: string; formId: ObjectId; data: Record<string, unknown>; updatedAt: Date }
```

`sessionId` is unique. Writes are `findOneAndUpdate` with `$set` on `data.<key>` so two runs do not replace the whole document. `list` returns `data`. The platform binding's `storeDurable` is always true.

Cloudflare store stays in KV under `ORCR_SESSION::<session_id>::`. The worker and the loader use a `Map` when KV is absent. That map lives with the isolate. The API cannot read it.

`GET /api/forms/:slug/session/:sessionId` loads the form by slug and reads the store for `form.runtime`. An unknown slug is `404` `{ "error": "form_not_found" }`.

Platform:

```json
{ "sessionId": "…", "runtime": "platform", "durable": true, "readable": true, "store": {} }
```

Cloudflare with KV configured: the same shape, `runtime: "cloudflare"`, `durable: true`, store filled from KV.

Cloudflare without KV:

```json
{ "sessionId": "…", "runtime": "cloudflare", "durable": false, "readable": false, "store": null }
```

## Runtimes

Both runtimes build the same `ctx`. The Cloudflare wire body uses the author field names:

```json
{
  "session_id": "sess-1",
  "formId": "…",
  "stepId": "…",
  "event": "onSubmit",
  "pageId": "page-1",
  "formData": {},
  "forms": [],
  "env": {}
}
```

Loader requests also send `scriptId` (`<scriptId>::<sourceSha>`) and `scriptSource` (the revision's bundled ESM). The loader already caches on `scriptId::hash`. It keeps that. It stops setting `globalOutbound: null`, so `fetch` uses the default outbound.

The worker wrapper and the loader wrapper:

- Implement every hook, including `setOutputNode`.
- Set `ctx.env` to the payload `env` only. They do not spread the worker env or the KV binding into `ctx`.
- Keep an in-memory `Map` store when KV is missing, and honor `get`, `put`, and `list`.
- Capture `hook.log` and `console.debug`, `console.info`, `console.warn`, and `console.error` into `logs`.
- After `execute`, always return HTTP 200 and a `RunResult` JSON body, including throws. They do not call `Response.redirect` and they do not return `setResponse`'s payload as the HTTP body.

The platform Cloudflare adapter treats a 200 body with boolean `ok`, an array `fieldErrors`, and an array `logs` as a `RunResult` and returns it. Any other status or shape is `502 runtime_bad_response`. A failed fetch is `502 runtime_unavailable`.

The platform runtime:

- Uses the revision's `bundledCjs`. It does not bundle again at run time.
- Runs that CJS with `node:vm` `runInNewContext` and `timeout: SCRIPT_TIMEOUT_MS`. The wrapper is a CommonJS `module` / `exports` pair. The timeout is what makes a tight loop return `script_timeout`.
- Exposes `fetch`, `URL`, `URLSearchParams`, `TextEncoder`, `TextDecoder`, `crypto`, `AbortController`, `AbortSignal`, `queueMicrotask`, `setTimeout`, and `clearTimeout`.
- Does not expose `require`, `process`, `Buffer`, or `fs`.
- Routes `console` into `logs` with the same cap as `hook.log`.

`bundleScript` stops prepending a CommonJS wrapper around the author source. The author source is ESM. esbuild emits both an ESM bundle and a CJS bundle. Input that does not export `execute` throws. The worker uploader and the loader consume the ESM bundle. The platform vm consumes the CJS bundle.

`packages/backend/src/lib/local-executor.ts` is deleted. Nothing calls it.

## Data model

`Revision`:

```ts
{
  scriptId: ObjectId;
  version: number;
  source: string;
  bundledSource: string; // ESM bundle
  bundledCjs: string; // CJS bundle run by the platform vm
  sourceSha: string; // sha256 hex of bundledSource
  createdAt: Date;
}
```

Unique index on `{ scriptId, version }`.

`Binding`, one live row per script and runtime. Unique index on `{ scriptId: 1, runtime: 1 }`.

```ts
{
  scriptId: ObjectId;
  revisionId?: ObjectId;
  runtime: "platform" | "cloudflare";
  status: "active" | "failed";
  mode?: "loader" | "worker";
  target?: string;
  storeDurable: boolean;
  error?: string;
  publishedAt?: Date;
  history: Array<{
    revisionId?: ObjectId;
    status: "active" | "failed" | "superseded";
    mode?: "loader" | "worker";
    target?: string;
    error?: string;
    at: Date;
  }>;
}
```

A successful publish is one atomic upsert of the live fields. The replaced live fields are pushed to `history` with `status: "superseded"`. `history` keeps the newest 50 entries. A live row with `status: "failed"` is not a binding `/api/run` can use. `binding_missing` covers a missing row and a failed row. Mongo multi-document transactions are not required. Two concurrent publishes of the same runtime: the last upsert wins, and both revisions remain in the collection.

`Script` gains `env` (`Mixed`, default `{}`). `source` remains the draft.

`Form` gains `runtime` (`String`, enum `platform` | `cloudflare`, default `platform`).

`FormVersion` gains `flow` and `runtime`.

## Components

| Unit | Responsibility |
|---|---|
| `packages/shared/src/run.ts` | `RunRequest`, `RunResult`, `RuntimeKind`, `CloudflareMode` |
| `packages/shared/src/route-script.ts` | `routeScriptResult` |
| `packages/shared/src/script-runtime.ts` | `Ctx.event`, `Ctx.stepId` |
| `packages/deployer/src/bundle.ts` | Bundle author ESM and reject a missing `execute` |
| `packages/backend/src/runtime/platform.ts` | vm run against a `SessionStore` |
| `packages/backend/src/runtime/session-store.ts` | Mongo `session_stores` adapter |
| `packages/backend/src/runtime/cloudflare.ts` | Call loader or worker URL, accept only `RunResult` |
| `packages/backend/src/runtime/dispatch.ts` | Pure checks: step match, binding lookup result, runtime switch |
| `packages/backend/src/routes/run.ts` | `POST /api/run` |
| `packages/backend/src/models/revision.ts` | Revision |
| `packages/backend/src/models/binding.ts` | Binding |
| `packages/worker-template/src/index.ts` | Always return `RunResult` |
| `packages/worker-template/src/dynamic-wrapper.ts` | Same result shape, full hook, no env leak, in-memory store, fetch allowed |
| `packages/frontend/src/pages/FormFill.tsx` | Call `/api/run`, use `routeScriptResult`, show field errors |
| `packages/form/app/fill/[slug]/FormFlowEngine.tsx` | Same |
| `packages/form/app/fill/[slug]/FormPage.tsx` | Render `fieldErrors` for the current page |
| `packages/frontend/src/pages/ScriptDetail.tsx` | Deploy saves the textarea through `POST /api/scripts/:id/publish` and shows the JSON. It does not call Cloudflare. |
| `packages/frontend/src/pages/FormDetail.tsx` | Deploy publishes each distinct script id on the flow to the platform and shows the JSON array. It does not change `runtime`. Zero script steps returns `{ "published": [] }` without a request. |

`dispatch.ts` returns a decision object. The route performs I/O. Tests call the pure decision and the vm directly. They do not boot Mongo.

Remove the `/api/forms/*` deploy middleware from `packages/backend/src/index.ts` with the deploy route.

Docs to update in the same slice: `README.md`, `docs/worker-loader.md`, `docs/infra.md`, and `examples/user-script.js`. The docs describe platform as the default runtime and Cloudflare as an optional binding. The example is ESM.

## Tests

Runner: `node --import tsx --test` on `*.test.ts`. No new test framework. Add a root script `test` that runs those files. Mongo is not required.

`packages/deployer/src/bundle.test.ts`

- ESM `export async function execute` returns both `esm` and `cjs`, and the CJS exports `execute`.
- Missing `execute` throws.
- A bare import throws.

`packages/backend/src/runtime/platform.test.ts`

- `setOutputNode`, `setFieldError`, `setError`, `setRedirect`, and `setResponse` map onto one `RunResult`. Field errors leave `ok` true when `setError` was not called.
- A thrown script returns `script_threw` and keeps prior logs.
- A script that loops hits `script_timeout` under a short timeout.
- Two runs with one in-memory store see `setStoreData` from the first run.
- `ctx.env` is the object passed in, and `process` is absent inside the script.

`packages/shared/src/route-script.test.ts`

- One case for each of the seven routing rules, plus redirect winning over a matching `outputNode`.

`packages/backend/src/runtime/dispatch.test.ts`

- Script id mismatch, non-script step, missing step, missing binding.
- Form runtime `platform` selects the platform binding when a Cloudflare binding also exists.
- Switch to Cloudflare with one unbound script step is blocked and names that step.
- Switch to Cloudflare with no script steps is allowed.
- Switch to platform is allowed.

`packages/backend/src/runtime/cloudflare.test.ts`

- A 200 `RunResult` is returned unchanged.
- HTTP 500 and a 200 body without `ok` become `runtime_bad_response`.
- A rejected fetch becomes `runtime_unavailable`.

## Filler behavior

For a script step, each filler posts:

```json
{
  "sessionId": "<existing session id>",
  "formId": "<form._id>",
  "stepId": "<step.id>",
  "scriptId": "<step.scriptId>",
  "event": "<step.event>",
  "pageId": "<current page id when the previous step was a page>",
  "formData": {}
}
```

`pageId` is the page the user just left, when there was one.

On non-200, show the failure outcome with `message` or `error`. On 200, call `routeScriptResult` and do what it says. Redirect uses `window.location.assign` in the browser. Field errors on a page render next to the matching field and as a list for names the page does not contain. Layout, CSS, and copy stay as they are aside from those messages.

## Success criteria

- A script published with no Cloudflare env vars runs through `POST /api/run` and returns `RunResult`.
- A second run with the same `sessionId` sees store keys written by the first.
- A form whose runtime is `platform` never calls Cloudflare, even when a Cloudflare binding exists.
- A form cannot switch to `cloudflare` while a script step lacks an active Cloudflare binding.
- A failed compile does not change the active platform binding.
- A failed worker upload does not change the active platform binding or the previous active Cloudflare binding.
- Both fillers follow one script step and one routing function.
- `POST /api/submit` and both deploy routes are gone.
