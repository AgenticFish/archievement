// test/promote/expand.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { expandFileToDir } from "../../lib/promote/expand.js";
import { readEntry } from "../../lib/entries/read.js";
import { entryFilePath, entryIndexPath } from "../../lib/entries/path.js";

const TODAY = "2026-05-23";

test("expandFileToDir converts file-layout entry to dir-layout", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "convert-me" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "# Title\n\nBody here.\n",
      now: TODAY,
    });
    const ptr = created.pointer;
    expandFileToDir(root, ptr);
    assert.equal(existsSync(entryFilePath(root, ptr)), false);
    assert.equal(existsSync(entryIndexPath(root, ptr)), true);
    const reread = readEntry(root, ptr);
    assert.equal(reread.layout, "dir");
    assert.equal(reread.data.layout, "dir");
    assert.match(reread.body, /Body here/);
  });
});

test("expandFileToDir is a no-op for an already-dir entry", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "PROJ-9" },
      layout: "dir",
      extras: { ticket_id: "PROJ-9", project: "project-a" },
      body: "Already a dir.\n",
      now: TODAY,
    });
    expandFileToDir(root, created.pointer); // should not throw
    const entry = readEntry(root, created.pointer);
    assert.equal(entry.layout, "dir");
  });
});

test("expandFileToDir throws when entry does not exist", async () => {
  await withTmpDir(async (root) => {
    assert.throws(
      () => expandFileToDir(root, { category: "work", type: "ticketed", id: "MISSING" }),
      /not found/,
    );
  });
});
