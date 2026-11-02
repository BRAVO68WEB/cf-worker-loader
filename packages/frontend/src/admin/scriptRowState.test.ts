import assert from "node:assert/strict";
import test from "node:test";
import { scriptIdOf, scriptRowState } from "./scriptRowState.ts";

const activePlatform = { status: "active" };

test("script id coercion", () => {
  assert.equal(scriptIdOf("abc"), "abc");
  assert.equal(scriptIdOf({ _id: "id-1" }), "id-1");
  assert.equal(scriptIdOf(""), "");
  assert.equal(scriptIdOf(null), "");
  assert.equal(scriptIdOf(undefined), "");
});

test("empty script id is the no-script row", () => {
  assert.deepEqual(scriptRowState({ scriptId: "", platform: activePlatform, cloudflare: activePlatform }), {
    kind: "no-script",
  });
});

test("missing or failed platform is unpublished", () => {
  assert.equal(scriptRowState({ scriptId: "s", platform: null, cloudflare: null }).kind, "unpublished");
  assert.equal(
    scriptRowState({ scriptId: "s", platform: { status: "failed" }, cloudflare: null }).kind,
    "unpublished"
  );
});

test("active platform with a missing or failed cloudflare binding is unbound", () => {
  assert.deepEqual(scriptRowState({ scriptId: "s", platform: activePlatform, cloudflare: null }), {
    kind: "unbound",
  });
  assert.deepEqual(
    scriptRowState({
      scriptId: "s",
      platform: activePlatform,
      cloudflare: { status: "failed", error: "upload failed" },
    }),
    { kind: "unbound", error: "upload failed" }
  );
});

test("active loader offers worker", () => {
  assert.deepEqual(
    scriptRowState({
      scriptId: "s",
      platform: activePlatform,
      cloudflare: { status: "active", mode: "loader", target: "http://loader" },
    }),
    { kind: "bound", mode: "loader", target: "http://loader", other: "worker" }
  );
});

test("active worker offers loader", () => {
  assert.deepEqual(
    scriptRowState({
      scriptId: "s",
      platform: activePlatform,
      cloudflare: { status: "active", mode: "worker", target: "https://orcratration-s.workers.dev" },
    }),
    { kind: "bound", mode: "worker", target: "https://orcratration-s.workers.dev", other: "loader" }
  );
});
