// test/promote/move.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { readEntry } from "../../lib/entries/read.js";
import { moveEntry } from "../../lib/promote/move.js";
import { entryFilePath, entryDirPath } from "../../lib/entries/path.js";

const TODAY = "2026-05-23";

test("moveEntry moves a file-layout entry and writes reciprocal links", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "spark" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "An idea.\n",
      now: TODAY,
    });
    const from = created.pointer;
    const to = { category: "work", type: "unticketed", id: "spark-poc" };

    moveEntry(root, from, to, { now: TODAY, layout: "file" });

    // source still exists (audit trail) but is done + promoted_to
    assert.ok(existsSync(entryFilePath(root, from)));
    const source = readEntry(root, from);
    assert.equal(source.data.status, "done");
    assert.equal(source.data.promoted_to, "work/unticketed/spark-poc");
    assert.equal(source.data.updated, TODAY);

    // target exists with promoted_from
    const target = readEntry(root, to);
    assert.equal(target.data.category, "work");
    assert.equal(target.data.type, "unticketed");
    assert.equal(target.data.promoted_from, "personal/idea/spark");
    assert.match(target.body, /An idea/);
  });
});

test("moveEntry throws if target already exists", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "src" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "src body",
      now: TODAY,
    });
    createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "DUP" },
      layout: "dir",
      extras: { ticket_id: "DUP", project: "x" },
      body: "dup body",
      now: TODAY,
    });
    assert.throws(
      () =>
        moveEntry(
          root,
          { category: "personal", type: "idea", id: "src" },
          { category: "work", type: "ticketed", id: "DUP" },
          { now: TODAY, layout: "dir" },
        ),
      /already exists/,
    );
  });
});

test("moveEntry preserves the source dir (audit trail) when moving dir-layout entry", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "work", type: "unticketed", id: "research-foo" },
      layout: "dir",
      extras: { project: "project-a", topic: "research foo" },
      body: "Research overview.\n",
      now: TODAY,
    });
    moveEntry(
      root,
      created.pointer,
      { category: "work", type: "ticketed", id: "PROJ-999" },
      { now: TODAY, layout: "dir", extras: { ticket_id: "PROJ-999" } },
    );
    // source dir still exists with status:done + promoted_to
    assert.ok(existsSync(entryDirPath(root, created.pointer)));
    const source = readEntry(root, created.pointer);
    assert.equal(source.data.status, "done");
    assert.equal(source.data.promoted_to, "work/ticketed/PROJ-999");
    const target = readEntry(root, { category: "work", type: "ticketed", id: "PROJ-999" });
    assert.equal(target.data.ticket_id, "PROJ-999");
    assert.equal(target.data.promoted_from, "work/unticketed/research-foo");
  });
});
