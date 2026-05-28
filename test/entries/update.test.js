// test/entries/update.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { readEntry } from "../../lib/entries/read.js";
import {
  updateEntryFrontmatter,
  appendToBody,
  appendToSiblingDoc,
  writeSiblingDoc,
} from "../../lib/entries/update.js";

const TODAY = "2026-05-23";
const TOMORROW = "2026-05-24";

test("updateEntryFrontmatter changes status and updated date", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "PROJ-1" },
      layout: "dir",
      extras: { ticket_id: "PROJ-1", project: "project-a" },
      body: "",
      now: TODAY,
    });
    updateEntryFrontmatter(root, created.pointer, { status: "in-progress", updated: TOMORROW });
    const entry = readEntry(root, created.pointer);
    assert.equal(entry.data.status, "in-progress");
    assert.equal(entry.data.updated, TOMORROW);
  });
});

test("appendToBody appends a section to the body of a file-layout entry", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "thing" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "Initial idea.\n",
      now: TODAY,
    });
    appendToBody(root, created.pointer, "\n## 2026-05-23\n\nMore thinking.\n");
    const entry = readEntry(root, created.pointer);
    assert.match(entry.body, /Initial idea/);
    assert.match(entry.body, /More thinking/);
  });
});

test("appendToBody appends to index.md body of a dir-layout entry, leaving siblings untouched", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "PROJ-100" },
      layout: "dir",
      extras: { ticket_id: "PROJ-100", project: "project-a" },
      body: "# PROJ-100\n\nInitial scope.\n",
      now: TODAY,
    });
    appendToBody(root, created.pointer, "\n## Implementation\n\nLanded in PR #99.\n");
    const entry = readEntry(root, created.pointer);
    assert.match(entry.body, /Initial scope/);
    assert.match(entry.body, /Implementation/);
    // No sibling docs created.
    const dir = dirname(created.path);
    assert.deepEqual(readdirSync(dir), ["index.md"]);
  });
});

test("appendToSiblingDoc creates the sibling doc and appends to it on subsequent calls", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "PROJ-2" },
      layout: "dir",
      extras: { ticket_id: "PROJ-2", project: "project-a" },
      body: "",
      now: TODAY,
    });
    appendToSiblingDoc(root, created.pointer, "progress", "## 2026-05-23\n\nStarted.\n");
    const dir = dirname(created.path);
    assert.ok(existsSync(join(dir, "progress.md")));
    appendToSiblingDoc(root, created.pointer, "progress", "## 2026-05-24\n\nMore work.\n");
    const reread = readEntry(root, created.pointer);
    assert.equal(reread.data.category, "work"); // index.md untouched
  });
});

test("appendToSiblingDoc throws on file-layout entries", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "flat" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "",
      now: TODAY,
    });
    assert.throws(() => appendToSiblingDoc(root, created.pointer, "progress", "x"), /file-layout/);
  });
});

test("writeSiblingDoc creates a new file under a dir-layout entry's directory", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "PROJ-3" },
      layout: "dir",
      extras: { ticket_id: "PROJ-3", project: "project-a" },
      body: "",
      now: TODAY,
    });
    writeSiblingDoc(
      root,
      created.pointer,
      "pr-summaries/2026-05-15-pr-456.md",
      "# PR 456\n\nSummary.\n",
    );
    const dir = dirname(created.path);
    assert.ok(existsSync(join(dir, "pr-summaries", "2026-05-15-pr-456.md")));
  });
});

test("writeSiblingDoc throws when called on a file-layout entry", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "flat" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "",
      now: TODAY,
    });
    assert.throws(() => writeSiblingDoc(root, created.pointer, "extra.md", "x"), /file-layout/);
  });
});
