import assert from "node:assert/strict";
import test from "node:test";
import { missingLabels, switchReason } from "./switchReason.ts";

test("no labels returns no reason", () => {
  assert.equal(switchReason([]), null);
});

test("one label uses has", () => {
  assert.equal(
    switchReason(["Remember the name"]),
    "Switch off. Remember the name has no Cloudflare binding."
  );
});

test("two labels use and and have", () => {
  assert.equal(
    switchReason(["Remember the name", "Route the brief"]),
    "Switch off. Remember the name and Route the brief have no Cloudflare binding."
  );
});

test("three labels use a comma list and have", () => {
  assert.equal(
    switchReason(["Remember the name", "Route the brief", "Route the RSVP"]),
    "Switch off. Remember the name, Route the brief, and Route the RSVP have no Cloudflare binding."
  );
});

test("missingLabels keeps order, drops open steps, and keeps a label once", () => {
  assert.deepEqual(
    missingLabels([
      { label: "Remember the name", blocked: true },
      { label: "Route the brief", blocked: false },
      { label: "Remember the name", blocked: true },
      { label: "Route the RSVP", blocked: true },
    ]),
    ["Remember the name", "Route the RSVP"]
  );
});
