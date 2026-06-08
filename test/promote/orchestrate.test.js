// test/promote/orchestrate.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { readEntry } from "../../lib/entries/read.js";
import { promote } from "../../lib/promote/orchestrate.js";
import { entryIndexPath, entryFilePath } from "../../lib/entries/path.js";

const TODAY = "2026-05-23";

test("promote(idea → ticketed) graduates: target at <TICKET>-<slug>, source deleted, no links", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "work", type: "idea", id: "tbd_spark" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "Spark of an idea.\n",
      now: TODAY,
    });

    const result = promote(
      root,
      { category: "work", type: "idea", id: "tbd_spark" },
      { category: "work", type: "ticketed", id: "project-a_PROJ-100-spark" },
      {
        now: TODAY,
        targetLayout: "dir",
        extras: { ticket_id: "PROJ-100", project: "project-a" },
      },
    );

    assert.equal(
      result.target.path,
      entryIndexPath(root, { category: "work", type: "ticketed", id: "project-a_PROJ-100-spark" }),
    );
    const target = readEntry(root, {
      category: "work",
      type: "ticketed",
      id: "project-a_PROJ-100-spark",
    });
    assert.equal(target.data.ticket_id, "PROJ-100");
    assert.equal(target.data.promoted_from, undefined);
    assert.match(target.body, /Spark of an idea/);
    assert.equal(
      existsSync(entryFilePath(root, { category: "work", type: "idea", id: "tbd_spark" })),
      false,
    );
  });
});

test("promote cross-category (personal idea → work ticketed) graduates with slug preserved", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "tbd_cross" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "Cross-cat idea.\n",
      now: TODAY,
    });
    promote(
      root,
      { category: "personal", type: "idea", id: "tbd_cross" },
      { category: "work", type: "ticketed", id: "project-a_PROJ-555-cross" },
      { now: TODAY, targetLayout: "dir", extras: { ticket_id: "PROJ-555", project: "project-a" } },
    );
    const target = readEntry(root, {
      category: "work",
      type: "ticketed",
      id: "project-a_PROJ-555-cross",
    });
    assert.equal(target.data.category, "work");
    assert.equal(target.data.promoted_from, undefined);
    assert.equal(
      existsSync(entryFilePath(root, { category: "personal", type: "idea", id: "tbd_cross" })),
      false,
    );
  });
});

test("promote rejects a target whose slug differs from the source slug", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "tbd_spark" },
      layout: "file",
      extras: {},
      body: "x",
      now: "2026-05-29",
    });
    assert.throws(
      () =>
        promote(
          root,
          { category: "personal", type: "idea", id: "tbd_spark" },
          { category: "personal", type: "unticketed", id: "tbd_renamed-spark" },
          { now: "2026-05-29", targetLayout: "file" },
        ),
      /must preserve the slug/,
    );
  });
});

test("promote accepts a ticketed target named <TICKET>-<slug>", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "tbd_spark" },
      layout: "file",
      extras: {},
      body: "x",
      now: "2026-05-29",
    });
    const res = promote(
      root,
      { category: "personal", type: "idea", id: "tbd_spark" },
      { category: "work", type: "ticketed", id: "egs-mobile_EGA-1-spark" },
      { now: "2026-05-29", targetLayout: "dir", extras: { ticket_id: "EGA-1" } },
    );
    assert.equal(res.target.pointer.id, "egs-mobile_EGA-1-spark");
  });
});
