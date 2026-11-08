import assert from "node:assert/strict";
import test from "node:test";
import { playerHref, runtimeLabel, scriptSteps, sortForms, truncateJson } from "./desk.ts";

test("sorts forms by name then id", () => {
  assert.deepEqual(
    sortForms([
      { name: "Evening", _id: "2" },
      { name: "Welcome", _id: "1" },
      { name: "Welcome", _id: "0" },
    ]).map((form) => form._id),
    ["2", "0", "1"]
  );
});

test("a missing runtime reads as Platform", () => {
  assert.equal(runtimeLabel(undefined), "Platform");
  assert.equal(runtimeLabel("cloudflare"), "Cloudflare");
  assert.equal(runtimeLabel("platform"), "Platform");
});

test("player href uses the default origin and encodes the slug", () => {
  assert.equal(playerHref("welcome", undefined), "http://localhost:4000/fill/welcome");
  assert.equal(playerHref("welcome", "http://localhost:4000/"), "http://localhost:4000/fill/welcome");
  assert.equal(playerHref("a/b", "  "), "http://localhost:4000/fill/a%2Fb");
});

test("script steps keep flow order", () => {
  assert.deepEqual(
    scriptSteps([
      { id: "start", type: "start" },
      { id: "script-1", type: "script" },
      { id: "page-1", type: "page" },
      { id: "script-2", type: "script" },
    ]).map((step) => step.id),
    ["script-1", "script-2"]
  );
});

test("truncateJson cuts the rendered text at 8000 characters", () => {
  const short = truncateJson({ name: "Ava" });
  assert.equal(short.truncated, false);
  assert.equal(short.text, '{\n  "name": "Ava"\n}');
  const long = truncateJson("x".repeat(8001));
  assert.equal(long.truncated, true);
  assert.equal(long.text.length, 8000);
});
