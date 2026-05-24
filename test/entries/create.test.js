// test/entries/create.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { readFrontmatter } from "../../lib/frontmatter.js";
import { locateEntry, entryFilePath, entryIndexPath } from "../../lib/entries/path.js";

const TODAY = "2026-05-23";

test("createEntry writes a file-layout entry with correct frontmatter", async () => {
  await withTmpDir(async (root) => {
    const result = createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "streaming-md-parser" },
      layout: "file",
      extras: { seed_date: TODAY, tags: ["parser"] },
      body: "Brainstorm: ...\n",
      now: TODAY,
    });
    assert.equal(result.layout, "file");
    assert.equal(result.path, entryFilePath(root, result.pointer));
    const { data, body } = readFrontmatter(result.path);
    assert.equal(data.category, "personal");
    assert.equal(data.type, "idea");
    assert.equal(data.status, "todo");
    assert.equal(data.created, TODAY);
    assert.equal(data.updated, TODAY);
    assert.equal(data.layout, "file");
    assert.equal(data.seed_date, TODAY);
    assert.deepEqual(data.tags, ["parser"]);
    assert.match(body, /Brainstorm/);
  });
});

test("createEntry writes a dir-layout entry with index.md", async () => {
  await withTmpDir(async (root) => {
    const result = createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "PROJ-123" },
      layout: "dir",
      extras: { ticket_id: "PROJ-123", project: "project-a" },
      body: "Overview of PROJ-123.\n",
      now: TODAY,
    });
    assert.equal(result.layout, "dir");
    assert.equal(result.path, entryIndexPath(root, result.pointer));
    const located = locateEntry(root, result.pointer);
    assert.equal(located.layout, "dir");
    const { data } = readFrontmatter(located.path);
    assert.equal(data.ticket_id, "PROJ-123");
    assert.equal(data.project, "project-a");
  });
});

test("createEntry refuses to overwrite an existing entry", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "dup" },
      layout: "file",
      extras: {},
      body: "",
      now: TODAY,
    });
    assert.throws(
      () =>
        createEntry(root, {
          pointer: { category: "personal", type: "idea", id: "dup" },
          layout: "file",
          extras: {},
          body: "",
          now: TODAY,
        }),
      /already exists/,
    );
  });
});
