// test/reports/prediction.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { updateEntryFrontmatter } from "../../lib/entries/update.js";
import { collectPredictionData } from "../../lib/reports/prediction.js";

const D = (n) => `2026-05-${String(n).padStart(2, "0")}`;

test("collectPredictionData returns ideas and recent active/done entries from both categories", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "work", type: "idea", id: "auto-tag" },
      layout: "file",
      extras: { seed_date: D(1) },
      body: "Auto-tag idea body.\n",
      now: D(1),
    });
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "spark" },
      layout: "file",
      extras: { seed_date: D(2) },
      body: "Spark.\n",
      now: D(2),
    });
    createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "PROJ-1" },
      layout: "dir",
      extras: { ticket_id: "PROJ-1", project: "project-a" },
      body: "Active ticket.\n",
      now: D(5),
    });
    updateEntryFrontmatter(
      root,
      { category: "work", type: "ticketed", id: "PROJ-1" },
      { status: "in-progress", updated: D(20) },
    );
    createEntry(root, {
      pointer: { category: "personal", type: "learning", id: "rust-async" },
      layout: "dir",
      extras: { topic: "rust async" },
      body: "Learning rust async.\n",
      now: D(3),
    });
    updateEntryFrontmatter(
      root,
      { category: "personal", type: "learning", id: "rust-async" },
      { status: "done", updated: D(22) },
    );

    const data = collectPredictionData(root, { now: D(23), lookbackDays: 60 });
    const ideaIds = data.ideas.map((i) => i.pointer.id).sort();
    assert.deepEqual(ideaIds, ["auto-tag", "spark"]);
    const activeIds = data.activeAndRecentDone.map((e) => e.pointer.id).sort();
    assert.deepEqual(activeIds, ["PROJ-1", "rust-async"]);
  });
});
