# Admin portal

Admin is the night desk for what is running now. An operator picks a form, sees its live runtime, binds any script step that still lacks Cloudflare, switches the form, and opens stored session keys. The player opens in the Next app.

This is the UX slice the execution contract left open. It supersedes two sentences in that spec: Admin no longer lists old `Deployment` rows, and Cloudflare binding and the runtime switch are no longer API-only. `GET /api/deployments` still reads the frozen collection. Nothing in this slice writes a `Deployment`. Publish, run, the worker, and the player stay as they are.

## Locked decisions

1. Admin operates the live runtime. The deployments table leaves this page.
2. The home is a form desk. The list is on the left. One form is open on the right.
3. The room is the night desk: black, white, and coral, wide, with compact rows. It is not the fill stage and it is not the gray creator column.
4. Each script row can bind Cloudflare as `loader` or `worker`. The switch stays off until every script step has an active Cloudflare binding, and the reason names the missing steps.
5. Flow, fields, and script source stay in the creator. A script name links to `/scripts/:id`.
6. Platform sessions for the open form are listed from `session_stores`. Opening a listed row reads that Mongo document even after the form switches to Cloudflare. A typed session id reads the live runtime through the existing session route. Cloudflare runs are not indexed.
7. Login and roles stay as they are. Admin is as open as Forms and Scripts.

## Non-goals

- Editing the flow, the fields, or the script source. No publish button on the desk.
- A runtime confirm dialog. The switch sends `PATCH` on click.
- Listing, searching, or deleting deployments. No writes to the frozen `Deployment` collection.
- Indexing Cloudflare KV sessions into Mongo. No change to the run path, the worker, or the loader.
- Changing `GET /api/forms/:slug/session/:sessionId`, including its empty-store result when a KV read fails.
- Auth, ownership, and RBAC.
- Restyling Forms, Scripts, Login, the home page, or the Vite filler. Home copy stays as it is. The existing frontend typecheck failure, hoisted `@types/react` 19 against React 18, stays out of this slice.
- Session delete, session pagination past 20, and binding history.
- A Mongo-backed test harness.

## Place

Admin stays in the Vite creator, inside the existing layout, on `/admin` and `/admin/:formId`.

`GET /api/forms` is the list. The client sorts it with `localeCompare` on `name`, then by `_id`. Opening `/admin` replaces the URL with `/admin/:formId` for the first id, so a refresh keeps that form. The form request starts after that id is in the URL. With no forms, the URL stays `/admin`. The desk says "No forms yet." and links to `/forms/new` with the label "Create form". An id that `GET /api/forms/:id` answers with `404` still shows the list, and the desk says "This form was not found." The desk does not request scripts or sessions after that 404. That route's error key remains `not_found`.

The nav links stay: Orcratration, Forms, Create form, Scripts, Admin. The layout adds `layout-night` only when the path is `/admin` or starts with `/admin/`. Under that class the page background is `#0c0c0c`, the nav background is `#0c0c0c`, nav links are `#fff`, and `main` loses the 720px column, the auto margin, and its padding. Other routes keep the gray column and the blue links.

The desk is full width. The list is 240px. Below 720px the list stacks above the desk, both at full width. The desk padding is 24px. The selected form has background `#1a1a1a` and a 2px `#ff5a36` left edge. Muted text is `rgba(255,255,255,0.45)`. Hairlines are `rgba(255,255,255,0.12)`.

Outfit 400 and 500 load from a stylesheet inserted by the admin route. The night root uses `font-family: Outfit, sans-serif`. Gray pages keep `system-ui`. Session ids, key names, and JSON values use `ui-monospace, monospace`.

Open player sits in the desk header. The href is `{origin}/fill/{slug}` in a new tab with `rel="noreferrer"`. The slug is encoded as one path segment. `origin` is `import.meta.env.VITE_PLAYER_ORIGIN` with any trailing slash removed, or `http://localhost:4000` when that env is empty. The label is "Open player".

A missing `runtime` on a form displays as Platform.

## Desk

Top to bottom on the open form:

1. Header: form name, the live runtime ("Platform" or "Cloudflare"), and Open player.
2. The runtime switch.
3. Script rows, or "This form has no script steps."
4. Platform sessions.

The list row shows the form name and, under it, Platform or Cloudflare in muted type.

The night shell paints immediately. Until the form list returns, the desk says "Loading…". If that request fails, the page says "Could not load forms." and the desk stays empty.

Changing `/admin/:formId`, or leaving the page, aborts the in-flight form, script, session, bind, and switch requests. An abort draws nothing. A late response for a different form id is ignored.

`GET /api/forms/:id` is the flow the desk uses. `scriptId` on a flow step is coerced the way the server already does: an object with `_id` uses that `_id`, otherwise `String(scriptId)`.

## Runtime switch

The control has two sides, Platform and Cloudflare. The live side is white on `#1a1a1a`. The other side is muted. Clicking the live side does nothing. Clicking the other side sends:

```json
PATCH /api/forms/:id/runtime
{ "runtime": "platform" }
```

or `"cloudflare"`. There is no confirm step. While the request runs, both sides are disabled. Success sets the header and the list row from `{ "runtime" }`. Failure leaves the previous runtime.

Cloudflare is disabled until every script step has settled and every one of them has an active Cloudflare binding. During the script load, Cloudflare is disabled and the reason line is absent. Platform remains clickable.

A step blocks the switch when it has no `scriptId`, its script request failed, or its Cloudflare binding is missing or not `status: "active"`. The legacy `scripts` array is ignored. A form with no script steps does not block. The server rule is unchanged: `409` with `error: "runtime_switch_blocked"` and this exact message:

```text
Every script step needs an active Cloudflare binding
```

The desk reason is separate, and it names the steps. The desk builds one `{ label, blocked }` entry per script step in flow order. `label` is the loaded script `name`, or the step id when that name is blank, the `scriptId` is missing, or the script request failed. `blocked` is true in those same missing-id and failed-request cases, and when the Cloudflare binding is missing or not `active`. `missingLabels` keeps the blocked entries and keeps each label once. `switchReason` joins that list. An unpublished platform binding does not block the switch when the Cloudflare binding is already `active`.

| Missing labels | Reason |
|---|---|
| one | `Switch off. Remember the name has no Cloudflare binding.` |
| two | `Switch off. Remember the name and Route the brief have no Cloudflare binding.` |
| three or more | `Switch off. Remember the name, Route the brief, and Route the RSVP have no Cloudflare binding.` |

One label uses "has". Two or more use "have". The line sits on `#161616` in `#ffb4a6`. A switch failure also uses the error table below. When that table does not match, the line is "Could not switch."

## Script rows

Rows are `flow` steps with `type: "script"`, in array order. Page, start, and end steps are not rows.

Each distinct script id is loaded once with `GET /api/scripts/:id`. The row uses `name` and `bindings.platform` / `bindings.cloudflare` from that payload. It does not call `GET /api/scripts/:id/bindings`. The name links to `/scripts/:id`.

| Row | What it shows |
|---|---|
| No `scriptId` | The step id, and "This step has no script." No bind actions. |
| Script request failed | The step id, and "Could not load this script." No bind actions. |
| Platform binding missing or not `active` | The script name, and "Publish the script before binding Cloudflare". No bind actions. |
| Platform `active`, Cloudflare missing or not `active` | Coral "Bind loader" and "Bind worker". A non-empty `error` on the failed Cloudflare row is shown above the actions. |
| Both `active` | "Cloudflare loader" or "Cloudflare worker", the `target` in muted type when present, and a muted action for the other mode. |

`#ff5a36` marks the selected form's left edge and the two bind actions on an unbound row. The switch reason uses `#ffb4a6` on `#161616`. The other-mode action uses the same words, "Bind loader" or "Bind worker", in muted type.

Bind posts the active platform revision by omitting `revisionId`:

```json
POST /api/scripts/:id/bindings/cloudflare
{ "mode": "loader" }
```

`mode` is `loader` or `worker`. Every row that shares that script id says "Binding loader…" or "Binding worker…" and disables its bind actions until the response. Success applies the returned `binding` to every row with that script id, and the switch reason is computed again.

A non-2xx body is parsed with the error table below. A non-empty string `message` is shown on the row. When `binding.status` is `active`, the row stays on the bound presentation and shows that text. When `binding.status` is `failed` or the body has no binding, the row stays on the bind actions and shows that text. When the table does not match, the line is "Could not bind Cloudflare."

These API messages are shown as returned:

- `Publish the script before binding Cloudflare`
- `LOADER_URL is not set`
- `CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required`
- the upload `message` on `cloudflare_publish_failed`

An upload failure still follows the execution contract: a live `active` Cloudflare binding is left active, and a first failure upserts `status: "failed"`. The desk does not write that rule itself. Two binds of one script follow the existing last-upsert-wins rule.

## Sessions

The heading is "Platform sessions". Under it, muted: "Listed rows are platform stores."

`GET /api/forms/:id/sessions` returns the 20 newest `session_stores` documents for that form:

```json
{
  "sessions": [
    { "sessionId": "…", "updatedAt": "2026-11-02T00:00:00.000Z", "keys": ["name"] }
  ]
}
```

Sort is `updatedAt` descending. A missing `updatedAt` sorts last and is JSON `null`. The query and the presenter both cap at 20. `keys` are the own keys of `data` when `data` is a plain object. An array, `null`, or any other `data` yields `keys: []`. Values are not in this payload. A form with no rows returns `{ "sessions": [] }`. An unknown form id, including a CastError, is `404`:

```json
{ "error": "form_not_found" }
```

The model gains an index `{ formId: 1, updatedAt: -1 }`.

No rows: "No platform sessions yet." When the array length is 20, a muted line says "Showing the 20 latest platform sessions." A row shows the session id, the local date and time when `updatedAt` is present, and the key names. The time uses the browser locale.

Opening a row calls `GET /api/forms/:id/sessions/:sessionId`. The server loads the form first, then the document whose `sessionId` and `formId` both match. This read ignores `Form.runtime`.

```json
{ "sessionId": "…", "updatedAt": "…", "store": { "name": "Ava" } }
```

`store` is `data` when that is a plain object, otherwise `{}`. A missing pair is `404` `{ "error": "session_not_found" }`. The desk says "No platform session with that id on this form." One session is open at a time. Opening another replaces it.

Each value is `JSON.stringify(value, null, 2)`. The rendered string is cut at 8000 characters and followed by a muted "Truncated." The stored value is unchanged. An empty store says "No keys."

Below the list, the field label is "Open a session id on the live runtime" and the button is "Open". It calls the existing `GET /api/forms/:slug/session/:sessionId` with the id encoded as one path segment. That route still follows `Form.runtime`. Its response shape is unchanged.

- `readable: false` shows "This session is not readable. Cloudflare KV is not configured."
- `readable: true` with an empty store, or `store: null`, shows "No keys."
- A KV failure that the current reader turns into `{}` shows "No keys." This slice does not change that reader.
- A failed request says "Could not open that session." A `form_not_found` body says "This form was not found."

The live result uses the same detail area as a listed row. A session id that contains a slash cannot be addressed on that existing path.

Runs that never called `setStoreData` create no `session_stores` row. Cloudflare store writes stay in KV and do not appear in the list. Reusing a session id on another form still moves `formId` on the Mongo document, which is the current write. The list follows `formId`.

## Errors

`api.patch` matches `api.post`: a non-2xx response throws `Error` whose message is the raw body. `get`, `post`, and `patch` take an optional `AbortSignal` as their last argument. Existing callers keep their current arguments.

The desk parses a thrown body as JSON when it can.

| Body | Shown text |
|---|---|
| non-empty string `message` | that message |
| `error: "form_not_found"` and no message | "This form was not found." |
| `error: "session_not_found"` and no message | "No platform session with that id on this form." |
| `error: "script_not_found"` and no message | "This script was not found." |
| `error: "revision_not_found"` and no message | "That revision was not found." |
| anything else | the fallback for that action |

Fallbacks: "Could not switch.", "Could not bind Cloudflare.", "Could not load sessions.", "Could not open that session.", "Could not load this form." A script `GET` that fails uses "Could not load this script." and does not use the table above. A form `GET` that fails with HTTP 404 uses "This form was not found." Any other form `GET` failure uses "Could not load this form."

A sessions failure leaves the script rows in place.

## Components

| Unit | Responsibility |
|---|---|
| `packages/frontend/src/pages/Admin.tsx` | Night desk page. Loads the form list, selects `/admin/:formId`, composes the units below. |
| `packages/frontend/src/admin/FormList.tsx` | Names, runtimes, and the selected edge. |
| `packages/frontend/src/admin/RuntimeSwitch.tsx` | The two-way control, the named reason, and `PATCH`. |
| `packages/frontend/src/admin/ScriptRows.tsx` | Flow script steps, one script `GET` per id, and bind. |
| `packages/frontend/src/admin/SessionPanel.tsx` | The platform list, the Mongo open, and the live-runtime open. |
| `packages/frontend/src/admin/switchReason.ts` | `missingLabels` and `switchReason`. |
| `packages/frontend/src/admin/scriptRowState.ts` | The row table above, plus `scriptId` coercion. A failed script request is handled by the row component and does not call this function. |
| `packages/frontend/src/admin/apiErrorMessage.ts` | The error table above. |
| `packages/frontend/src/admin/admin.css` | Night-desk rules. Imported by the admin page only. |
| `packages/frontend/src/Layout.tsx` | `layout-night` on `/admin` and `/admin/:formId` only. |
| `packages/frontend/src/api.ts` | `patch`, and an optional `AbortSignal` on `get`, `post`, and `patch`. |
| `packages/backend/src/runtime/session-list.ts` | `presentSessionList`. Sort, cap, and key names. No I/O. |
| `packages/backend/src/routes/forms.ts` | The two session reads. The route checks the form, then calls the presenter or the single-document read. |
| `packages/backend/src/models/sessionStore.ts` | Index `{ formId: 1, updatedAt: -1 }`. |

`docs/infra.md` gains a short Admin note: the Vite `/admin` desk binds Cloudflare and switches runtime, lists platform sessions, and does not call `GET /api/deployments`. Name `VITE_PLAYER_ORIGIN` there. Do not edit the execution-contract spec. Its historical non-goal is superseded by this document.

## Tests

Runner stays `node --import tsx --test`. No new framework. No Mongo. The existing `packages/backend/src/runtime/*.test.ts` glob picks up the session-list test. Root `test:unit` also gains `packages/frontend/src/admin/*.test.ts`.

`packages/frontend/src/admin/switchReason.test.ts`

- No labels returns no reason.
- One label uses "has" and the exact "Switch off." sentence.
- Two labels use "and" and "have".
- Three labels use a comma list with "and" before the last, and "have".
- `missingLabels` keeps flow order, drops a step that is not blocked, and keeps a repeated label once.

`packages/frontend/src/admin/scriptRowState.test.ts`

- A string `scriptId` is kept. An object `{ _id }` uses `_id`. An empty `scriptId` is the no-script row.
- Platform missing, and platform `failed`, are the unpublished row.
- Platform `active` with no Cloudflare row, and with Cloudflare `failed`, are the unbound row. The failed row exposes `error`.
- Platform `active` and Cloudflare `active` `loader` is the bound row, with the other mode `worker` and the target.
- The same for `worker`, with the other mode `loader`.

`packages/frontend/src/admin/apiErrorMessage.test.ts`

- A non-empty string `message` wins over `error`. An empty `message` does not.
- `form_not_found`, `session_not_found`, `script_not_found`, and `revision_not_found` use the sentences in the error table.
- A non-JSON body uses the fallback.

`packages/backend/src/runtime/session-list.test.ts`

- Newest `updatedAt` is first. A missing `updatedAt` is last and becomes `null`.
- The result is capped at 20.
- Keys come from a plain object. An array, `null`, and missing `data` yield `keys: []`.
- The result has no store values.

The route files are not covered by a Mongo test. Browser check during implementation, against the running creator: Welcome shows Cloudflare disabled with "Switch off. Remember the name has no Cloudflare binding.", and opening Ava's listed session shows the stored `name` key.

## Success criteria

- `/admin` opens the night desk on a form, and the gray Forms and Scripts pages look as they do today.
- Welcome, with its platform binding and no Cloudflare binding, keeps the Cloudflare switch off and names "Remember the name".
- Binding that script as loader or worker, once the platform revision exists and the matching env is set, clears the reason. `PATCH` then returns the new runtime.
- A form with no script steps can switch to Cloudflare.
- Ava's platform session is in the list and opens `{ "name": "Ava" }` from Mongo.
- A typed session id on a Cloudflare form with KV reads KV. Without `KV_NAMESPACE_ID`, the desk says the session is not readable.
- Admin does not request `/api/deployments`.
