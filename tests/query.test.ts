import { test } from "node:test";
import assert from "node:assert/strict";
import { allRows, checked } from "../src/lib/query";

test("pagination does not truncate reports at the Supabase row limit", async () => {
  const source = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const rows = await allRows(async (from, to) => ({ data: source.slice(from, to + 1), error: null }));
  assert.equal(rows.length, 1201);
  assert.equal(rows.at(-1)?.id, 1200);
});
test("query failures cannot become empty, success-shaped reports", async () => {
  assert.throws(() => checked({ data: null, error: { message: "Unavailable" } }), /Unavailable/);
  await assert.rejects(allRows(async () => ({ data: null, error: { message: "Unavailable" } })), /Unavailable/);
});
