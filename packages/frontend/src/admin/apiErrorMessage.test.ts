import assert from "node:assert/strict";
import test from "node:test";
import { apiErrorMessage, bindFailure, isAbortError } from "./apiErrorMessage.ts";

test("a non-empty message wins over error", () => {
  const err = new Error(JSON.stringify({ message: "Nope", error: "form_not_found" }));
  assert.equal(apiErrorMessage(err, "Could not switch."), "Nope");
});

test("an empty message does not win", () => {
  const err = new Error(JSON.stringify({ message: "", error: "form_not_found" }));
  assert.equal(apiErrorMessage(err, "Could not switch."), "This form was not found.");
});

test("known error keys use the desk sentences", () => {
  assert.equal(apiErrorMessage(new Error(JSON.stringify({ error: "form_not_found" })), "x"), "This form was not found.");
  assert.equal(
    apiErrorMessage(new Error(JSON.stringify({ error: "session_not_found" })), "x"),
    "No platform session with that id on this form."
  );
  assert.equal(apiErrorMessage(new Error(JSON.stringify({ error: "script_not_found" })), "x"), "This script was not found.");
  assert.equal(apiErrorMessage(new Error(JSON.stringify({ error: "revision_not_found" })), "x"), "That revision was not found.");
});

test("a non-JSON body uses the fallback", () => {
  assert.equal(apiErrorMessage(new Error("nope"), "Could not switch."), "Could not switch.");
});

test("bind failure keeps a returned binding", () => {
  const err = new Error(JSON.stringify({ message: "upload failed", binding: { status: "active", mode: "loader" } }));
  assert.deepEqual(bindFailure(err), {
    text: "upload failed",
    binding: { status: "active", mode: "loader" },
  });
});

test("abort errors are recognized", () => {
  const err = new Error("aborted");
  err.name = "AbortError";
  assert.equal(isAbortError(err), true);
  assert.equal(isAbortError(new Error("nope")), false);
});
