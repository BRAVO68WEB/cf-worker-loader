import assert from "node:assert/strict";
import test from "node:test";
import { presentSessionDetail, presentSessionList } from "./session-list.js";

test("newest session is first and a missing updatedAt is last and null", () => {
  const result = presentSessionList([
    { sessionId: "old", data: { name: "skipped" } },
    { sessionId: "new", updatedAt: new Date("2026-11-02T00:00:00.000Z"), data: { name: "Ava" } },
  ]);
  assert.deepEqual(
    result.sessions.map((session) => session.sessionId),
    ["new", "old"]
  );
  assert.equal(result.sessions[0].updatedAt, "2026-11-02T00:00:00.000Z");
  assert.equal(result.sessions[1].updatedAt, null);
});

test("caps the list at 20 and drops store values", () => {
  const docs = Array.from({ length: 21 }, (_, index) => ({
    sessionId: `s${index}`,
    updatedAt: new Date(Date.UTC(2026, 0, index + 1)),
    data: { name: "Ava" },
  }));
  const result = presentSessionList(docs);
  assert.equal(result.sessions.length, 20);
  assert.equal(result.sessions[0].sessionId, "s20");
  assert.equal(
    result.sessions.some((session) => session.sessionId === "s0"),
    false
  );
  assert.equal(JSON.stringify(result).includes("Ava"), false);
  assert.equal("data" in result.sessions[0], false);
  assert.deepEqual(result.sessions[0].keys, ["name"]);
});

test("non-object data yields no keys", () => {
  const updatedAt = new Date("2026-11-02T00:00:00.000Z");
  const result = presentSessionList([
    { sessionId: "array", updatedAt, data: ["x"] },
    { sessionId: "null", updatedAt, data: null },
    { sessionId: "missing", updatedAt },
  ]);
  assert.deepEqual(
    result.sessions.map((session) => session.keys),
    [[], [], []]
  );
});

test("detail store is the plain object or empty", () => {
  assert.deepEqual(presentSessionDetail({ sessionId: "a", data: { name: "Ava" } }).store, { name: "Ava" });
  assert.deepEqual(presentSessionDetail({ sessionId: "a", data: ["x"] }).store, {});
  assert.equal(presentSessionDetail({ sessionId: "a" }).updatedAt, null);
});
