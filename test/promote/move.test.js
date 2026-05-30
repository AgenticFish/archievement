// test/promote/move.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { readEntry } from "../../lib/entries/read.js";
import { moveEntry } from "../../lib/promote/move.js";
import { entryFilePath, entryDirPath } from "../../lib/entries/path.js";

const TODAY = "2026-05-23";

test("moveEntry graduates a file-layout entry: target created, source deleted, no audit links", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "spark" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "An idea.\n",
      now: TODAY,
    });
    const from = created.pointer;
    const to = { category: "personal", type: "unticketed", id: "spark" };

    moveEntry(root, from, to, { now: TODAY, layout: "file" });

    assert.equal(existsSync(entryFilePath(root, from)), false);

    const target = readEntry(root, to);
    assert.equal(target.data.type, "unticketed");
    assert.equal(target.data.category, "personal");
    assert.equal(target.data.updated, TODAY);
    assert.equal(target.data.promoted_from, undefined);
    assert.equal(target.data.promoted_to, undefined);
    assert.match(target.body, /An idea/);
  });
});

test("moveEntry throws if target already exists", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "src" },
      layout: "file",
      extras: {},
      body: "src body",
      now: TODAY,
    });
    createEntry(root, {
      pointer: { category: "personal", type: "unticketed", id: "src" },
      layout: "file",
      extras: {},
      body: "dup body",
      now: TODAY,
    });
    assert.throws(
      () =>
        moveEntry(
          root,
          { category: "personal", type: "idea", id: "src" },
          { category: "personal", type: "unticketed", id: "src" },
          { now: TODAY, layout: "file" },
        ),
      /already exists/,
    );
  });
});

test("moveEntry on a dir-layout source copies attachments then deletes the source dir", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "work", type: "unticketed", id: "research-foo" },
      layout: "dir",
      extras: { project: "project-a" },
      body: "Research overview.\n",
      now: TODAY,
    });
    const srcDir = entryDirPath(root, created.pointer);
    mkdirSync(join(srcDir, "pr-summaries"), { recursive: true });
    writeFileSync(join(srcDir, "brainstorm.md"), "notes\n");

    const to = { category: "work", type: "ticketed", id: "PROJ-999-research-foo" };
    moveEntry(root, created.pointer, to, {
      now: TODAY,
      layout: "dir",
      extras: { ticket_id: "PROJ-999" },
    });

    assert.equal(existsSync(srcDir), false);
    assert.ok(existsSync(join(entryDirPath(root, to), "brainstorm.md")));
    assert.ok(existsSync(join(entryDirPath(root, to), "pr-summaries")));
    const target = readEntry(root, to);
    assert.equal(target.data.ticket_id, "PROJ-999");
    assert.equal(target.data.promoted_from, undefined);
  });
});
