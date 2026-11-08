# Fill experience

The public form is a full-viewport black stage. A person answers one field at a time. Text answers sit on an underline. Choices are large rows or picture tiles. A photo can split the screen. A coral dock in the bottom-right shows progress and moves up and down.

This slice rebuilds the player in `packages/form`. It does not redesign the creator.

The reference shots are a behavior and layout target. The gallery chrome on those shots (More Like This, Save, Permalink) is not part of the product. Copy is English.

## Locked decisions

1. The player shows one field per screen. A builder page is a group of fields, walked in order. The flow then continues.
2. The stage is black, full viewport, with no card and no top nav. The question block is left of center.
3. The first field of a page with a title shows that title as the lead line, numbered `n →`. The question underneath is the field label. Later fields on that page show only the numbered question.
4. Text-like fields use an underline. Picture choice is a row of tiles. Yes/no and multiple choice are large rows. Multiple answers use the same rows and toggle. A field photo splits the screen: question left, image right, full height. No photo keeps the black stage at full width. The player does not invent a background color.
5. Enter and Down advance. A single-answer choice advances at the moment it is selected. Multiple answers wait for Down or Enter. Up goes to the previous field and never re-runs a script.
6. The dock reads `{n}% completed`.
7. The public player is the Next app at `/fill/[slug]`. This slice does not restyle the Vite `/fill` page. The execution contract's thin Vite wiring still applies when that slice lands.
8. Script steps call `POST /api/run` and follow `routeScriptResult` from the execution contract.

## Non-goals

- Creator UI. The builder does not grow an options editor, a photo picker, or a theme picker in this slice. Fields that already contain `options` or `imageUrl` render. Authors can set them through the API.
- Per-question background colors, custom Yes/No labels, and locales.
- Resuming a session after refresh. Progress stays in memory.
- Porting this player into `packages/frontend`. Vite keeps its current layout.
- Changing the execution contract. This spec only consumes it.

## Field model

`FieldDef` in `packages/shared/src/forms.ts` gains:

```ts
export interface FieldOption {
  id: string;
  label: string;
  imageUrl?: string;
}

export interface FieldDef {
  id: string;
  name: string;
  label?: string;
  type: string;
  placeholder?: string;
  validation?: FieldValidation;
  options?: FieldOption[];
  /** Side photo. Used by yes/no, radio, select, and checkbox. */
  imageUrl?: string;
}
```

`type` values the player understands:

| `type` | Screen |
|---|---|
| `text`, `email`, `number`, `tel`, `url` | Underline input |
| `textarea` | Growing underline |
| `yesno` | Two rows, labels Yes and No. `options` is ignored. |
| `radio`, `select` | One-answer rows from `options` |
| `checkbox` | Toggle rows from `options` |
| `picture` | Tiles from `options`. A missing `imageUrl` on an option is a caption-only tile with a flat dark fill. |

Any other `type` renders as `text`.

The Mongoose field subdocument in `packages/backend/src/models/form.ts` and `formVersion.ts` is strict. Add `options` (`[{ id, label, imageUrl }]`) and `imageUrl` (string) there. Otherwise a save from the existing builder strips them.

Stored answers in `formData[pageId][field.name]`:

| Type | Value |
|---|---|
| text, email, tel, url, textarea | string |
| number | number |
| yesno, radio, select, picture | the selected option label. Yes/no stores `"Yes"` or `"No"`. |
| checkbox | `string[]` of selected labels, in option order |

Duplicate option labels are stored as that same label. The player does not disambiguate them.

## Walking the form

Start at the start step's `next`. A missing `flow` uses the linear flow the current engine already builds: start, one page step per page, success end.

A page step expands into one screen per field, in `page.fields` order. A page with no fields is skipped.

A script step is one screen, then `POST /api/run`. An end step is the outcome screen.

The player keeps a cursor over the fields committed in this visit. `answeredCount` is how many fields sit before the cursor. `n` is `answeredCount + 1`. The first field is `1`. Up moves the cursor back one field and does not delete the stored value. Down from a field already in the history updates that field's stored value and moves the cursor forward. It does not append a duplicate. A script that routes to an earlier page drops the history after that page and places the cursor on the field the route opens. `n` is the position in this visit, not a permanent question id.

The lead line:

- First field of a page, and `page.title` is non-empty: the lead line is `{n} → {page.title}`. Under it, the question is `field.label`, or `field.name` when the label is empty. The number is not repeated on the question.
- Every other field: one line, `{n} → {label or name}`.
- A required field puts a coral asterisk on the question line. The asterisk is `aria-hidden`. The control is `aria-required`.

## Progress

```ts
percent = Math.floor(answeredCount / total * 100)
```

`total` is `answeredCount` plus every not-yet-committed field from the current field through the deterministic horizon. The horizon is the current page's remaining fields, including the current one, then pages reached by following a single edge: `start.next`, `page.onSubmit`, or the only key in a script's `outputTargets`. The walk stops at an end step, a missing edge, or a script whose `outputTargets` has any count other than 1. Script steps add no fields. A missing `outputTargets` has no keys, so the walk stops there.

On the first field, `answeredCount` is 0, so the dock reads `0% completed`. The percent can drop after a branch reveals a longer path. The outcome screen does not show the dock.

## Stage

Background `#000000`. Text `#ffffff`. Muted text `rgba(255, 255, 255, 0.45)`. Underline `rgba(255, 255, 255, 0.9)`. Accent `#ff5a36`, used for the asterisk, errors, the dock button, the progress fill, and the selected choice border.

Font is Outfit, loaded with `next/font/google`, weights 400 and 500. Questions use weight 500. Desktop question size is 32px. Mobile question size is 26px. The lead line uses the question size.

Desktop question block: max-width 640px, left edge at `12vw`, the block's vertical center at `45vh`.

The dock is fixed `28px` from the right and bottom. It is a white pill with `#111111` text `{percent}% completed`, a 2px track `#ffd0c6`, and a fill `#ff5a36` whose width is the percent. Attached on the right is a `#ff5a36` button with two white chevrons, up and down. Buttons have accessible names Previous and Next. Down is disabled while a script runs and while a required choice has no options.

Below 720px the question block is inset 24px from the screen edges. The dock becomes a full-width bar on the bottom edge: the pill grows to fill the free space, and the coral button stays on the right.

## Text fields

The input has no box, no background, and a 1px underline. The placeholder is the field placeholder, in the muted color. The input is focused when the screen appears. Returning to a field focuses it with the caret at the end.

`email`, `tel`, `url`, and `number` set the matching input type and `inputMode`. Enter or Down commits. Shift+Enter does nothing on a single-line field.

`textarea` grows with the content, up to 40vh. Shift+Enter inserts a newline. Enter commits.

## Choices

Rows are full width of the question column, 1px border `rgba(255, 255, 255, 0.2)`, 8px radius, white text. The letter chip is muted. A selected row uses the accent border. Hover uses a brighter white border.

Letters are A, B, C… in option order, up to Z. Past Z, no letter is shown and the letter keys stop.

- `yesno`, `radio`, `select`, `picture`: choosing a row commits and advances. Choosing means click, letter key, or Enter on the highlighted row. Y and N also select Yes and No.
- `checkbox`: click or letter toggles. Enter or Down commits.
- Picture tiles are square, image `object-fit: cover`, caption underneath. Left and Right move the highlight. Enter on the highlight commits. Tiles sit in one wrapping row on desktop. Below 720px they are a horizontal snap scroll.

A single-answer screen that already has a stored value shows that row as selected and does not advance on mount. Advance happens only from a new selection or from Down/Enter.

A choice field with no options shows `This question has no choices.` Under the message, Down is disabled when the field is required. When it is not required, Down stores `null` and advances.

A side `imageUrl` on `yesno`, `radio`, `select`, or `checkbox` splits the viewport 50/50. The left half is the black question column. The right half is the image, `object-fit: cover`, full height. Below 720px the image is on top, max-height `32vh`, and the question follows. Picture choice does not use the side image. Its images are the tiles. `text` and `textarea` ignore `imageUrl`.

## Keyboard

The stage handles these keys unless a modifier other than Shift is held:

| Key | Action |
|---|---|
| Enter | Commit a text field. On a single-answer choice, commit the highlighted row. On checkbox, commit the toggles. |
| Shift+Enter | Newline in `textarea` only. |
| ArrowDown | Same as the dock's down button. |
| ArrowUp | Previous field. |
| ArrowLeft / ArrowRight | Move the picture-tile highlight. |
| A–Z | Select or toggle the matching row when the active control is not a text input. |
| Y / N | Yes or No on a `yesno` field. |
| Escape | No action. |

ArrowUp and ArrowDown call `preventDefault` so the page does not scroll.

## Validation

The client checks a field before commit.

| Case | Message |
|---|---|
| Required and empty, including checkbox with no selection | `Please fill this in` for text-like fields. `Please pick one` for a single choice. `Please pick at least one` for checkbox. |
| `email` that fails the browser email constraint | `Enter a valid email` |
| `url` that fails `URL` parsing | `Enter a valid URL` |
| `number` that is not finite | `Enter a number` |
| `tel` | Required check only |

On failure the underline or the choice group shakes 4px horizontally for 300ms, the message appears under the control in the accent color, and the screen does not change. Editing the value clears the message.

## Up, down, and scripts

Down on the last field of a page commits that page into `formData` and follows the flow.

Up from the first field of a page moves to the previous field screen in this session. If the previous flow step was a script, skip it and show the last field of the page before that script. If there is no previous field, Up does nothing. Scripts are not called on the way back.

A script screen uses the same black stage. The line is `One moment`. The dock stays. Down is disabled. Up aborts the in-flight request and returns to the previous field. The percent stays where it was when the script started.

The request body matches the execution contract:

```json
{
  "sessionId": "<id created on mount>",
  "formId": "<form._id>",
  "stepId": "<script step id>",
  "scriptId": "<script step scriptId>",
  "event": "<script step event>",
  "pageId": "<page just committed, if any>",
  "formData": {}
}
```

`sessionId` is `crypto.randomUUID()`, kept for the life of the page. Refresh starts a new one.

A 200 response goes through `routeScriptResult`.

- `redirect` assigns `window.location`.
- `step` moves to that flow step. When the step is a page, the player opens the first field on that page whose `name` is in `fieldErrors`. If none match, it opens the first field. Matching errors show under those fields. Unmatched errors for this arrival show as a list above the question. A new edit clears that field's script error.
- `outcome` shows the outcome screen. Field errors on an outcome are listed under the message.

A non-200 response shows the failure outcome with `message` or `error` from the body. It does not go through `routeScriptResult`.

## Outcomes

The dock is hidden.

Success: the form name as the lead line, then `Thank you.`

Failure: the form name, then the message. When there is no message, the line is `Something went wrong.`

Both screens show a text button, `Start over`. It clears `formData`, creates a new `sessionId`, and opens the first field.

## Motion

A forward move translates the outgoing screen up and the incoming screen up from below, 280ms, ease-out. A backward move reverses the direction. `prefers-reduced-motion: reduce` fades opacity over 120ms and does not translate.

## Loading and empty

While the form document is loading, the stage shows `Loading`. An unknown slug keeps the current not-found behavior of the route. A form with no fields on any reachable page shows `This form has no questions yet.`

## Components

| Unit | Responsibility |
|---|---|
| `packages/shared/src/forms.ts` | `FieldOption`, `options`, `imageUrl` |
| `packages/backend/src/models/form.ts` | Persist the new field fields |
| `packages/backend/src/models/formVersion.ts` | Same |
| `packages/form/lib/player.ts` | Pure helpers: expand a page into field screens, session index, lead line, progress horizon, previous-field target, choice letters |
| `packages/form/lib/player.test.ts` | Tests for those helpers |
| `packages/form/app/fill/[slug]/Player.tsx` | Replaces `FormFlowEngine`. Owns session, screen, `formData`, and `/api/run`. |
| `packages/form/components/player/Stage.tsx` | Black stage, motion, dock slot |
| `packages/form/components/player/TextField.tsx` | Underline and textarea |
| `packages/form/components/player/ChoiceRows.tsx` | Yes/no, radio, select, checkbox |
| `packages/form/components/player/PictureTiles.tsx` | Picture choice |
| `packages/form/components/player/Dock.tsx` | Percent and chevrons |
| `packages/form/app/globals.css` | Stage tokens. Remove the glass-card theme from the fill route. |

`FormPage.tsx` and `FormFlowEngine.tsx` are deleted once `Player` renders the route. `app/fill/[slug]/page.tsx` renders `Player`.

Tests use `node --import tsx --test`. Add `packages/form` to the root `test` script introduced by the execution-contract slice. If that script does not exist yet, this slice adds it with the player tests only.

Cases in `player.test.ts`:

- A page with three fields expands to three screens, in order. A page with no fields expands to none.
- The first field of a titled page leads with `{n} → {title}` and a separate question. The second field is only `{n} → {label}`.
- The first screen reports `0` percent when one field is ahead and nothing is answered.
- A script with two outputs stops the horizon. A script with one output includes the following page's fields.
- Previous-field from the first field after a script step is the last field of the page before that script.
- Letters are A, B, C in option order, and the 27th option has no letter.

## Success criteria

- `/fill/[slug]` shows one field on a black stage, with the coral dock reading `0% completed` on the first field.
- Enter advances a text field. Clicking a single choice advances immediately. A prefilled choice does not advance on mount.
- Up from the field after a script returns to the previous field and does not call `/api/run`.
- A script step posts one `/api/run` body and follows `routeScriptResult`.
- A choice field with a side image splits the screen. A text field with no image does not.
- Refreshing the page starts over.
- The Vite app is unchanged.
