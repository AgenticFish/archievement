// test/entries/read.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { readEntry } from "../../lib/entries/read.js";

const TODAY = "2026-05-23";

test("readEntry returns full entry data for an existing file-layout entry", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "work", type: "idea", id: "foo" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "Initial body.\n",
      now: TODAY,
    });
    const entry = readEntry(root, { category: "work", type: "idea", id: "foo" });
    assert.equal(entry.layout, "file");
    assert.equal(entry.data.category, "work");
    assert.equal(entry.data.type, "idea");
    assert.equal(entry.data.status, "todo");
    assert.match(entry.body, /Initial body/);
  });
});

test("readEntry returns null when entry is missing", async () => {
  await withTmpDir(async (root) => {
    const entry = readEntry(root, { category: "work", type: "ticketed", id: "GONE" });
    assert.equal(entry, null);
  });
});
