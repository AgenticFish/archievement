// test/promote/orchestrate.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { readEntry } from "../../lib/entries/read.js";
import { promote } from "../../lib/promote/orchestrate.js";
import { entryIndexPath } from "../../lib/entries/path.js";

const TODAY = "2026-05-23";

test("promote(idea → ticketed) expands file to dir and writes links", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "work", type: "idea", id: "spark" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "Spark of an idea.\n",
      now: TODAY,
    });

    const result = promote(
      root,
      { category: "work", type: "idea", id: "spark" },
      { category: "work", type: "ticketed", id: "PROJ-100" },
      {
        now: TODAY,
        targetLayout: "dir",
        extras: { ticket_id: "PROJ-100", project: "project-a" },
      },
    );

    assert.equal(
      result.target.path,
      entryIndexPath(root, { category: "work", type: "ticketed", id: "PROJ-100" }),
    );
    const target = readEntry(root, { category: "work", type: "ticketed", id: "PROJ-100" });
    assert.equal(target.data.ticket_id, "PROJ-100");
    assert.equal(target.data.promoted_from, "work/idea/spark");
    assert.match(target.body, /Spark of an idea/);
    const source = readEntry(root, { category: "work", type: "idea", id: "spark" });
    assert.equal(source.data.status, "done");
    assert.equal(source.data.promoted_to, "work/ticketed/PROJ-100");
  });
});

test("promote cross-category (personal idea → work ticketed)", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "cross" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "Cross-cat idea.\n",
      now: TODAY,
    });
    promote(
      root,
      { category: "personal", type: "idea", id: "cross" },
      { category: "work", type: "ticketed", id: "PROJ-555" },
      { now: TODAY, targetLayout: "dir", extras: { ticket_id: "PROJ-555", project: "project-a" } },
    );
    const target = readEntry(root, { category: "work", type: "ticketed", id: "PROJ-555" });
    assert.equal(target.data.category, "work");
    assert.equal(target.data.promoted_from, "personal/idea/cross");
  });
});
