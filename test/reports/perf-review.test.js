// test/reports/perf-review.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { updateEntryFrontmatter } from "../../lib/entries/update.js";
import { collectPerfReviewData } from "../../lib/reports/perf-review.js";

const D = (n) => `2026-04-${String(n).padStart(2, "0")}`;

test("collectPerfReviewData with category=work returns only work entries", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "PROJ-1" },
      layout: "dir",
      extras: { ticket_id: "PROJ-1", project: "project-a", prs: [{ id: 1 }, { id: 2 }] },
      body: "work entry body",
      now: D(1),
    });
    updateEntryFrontmatter(
      root,
      { category: "work", type: "ticketed", id: "PROJ-1" },
      { status: "done", updated: D(8) },
    );
    createEntry(root, {
      pointer: { category: "personal", type: "ticketed", id: "MYAPP-1" },
      layout: "dir",
      extras: { ticket_id: "MYAPP-1", project: "my-app" },
      body: "personal entry body",
      now: D(1),
    });
    updateEntryFrontmatter(
      root,
      { category: "personal", type: "ticketed", id: "MYAPP-1" },
      { status: "done", updated: D(10) },
    );

    const data = collectPerfReviewData(root, {
      category: "work",
      from: D(1),
      to: D(30),
    });
    assert.equal(data.entries.length, 1);
    assert.equal(data.entries[0].pointer.id, "PROJ-1");
    assert.equal(data.anchors.ticketsClosed, 1);
    assert.equal(data.anchors.prsMerged, 2);
  });
});

test("collectPerfReviewData rejects entries whose frontmatter disagrees with directory", async () => {
  await withTmpDir(async (root) => {
    // Manually craft a misplaced file: under work/ but with category: personal in frontmatter.
    const { writeFrontmatter } = await import("../../lib/frontmatter.js");
    const { join } = await import("node:path");
    writeFrontmatter(
      join(root, "work", "ticketed", "STRAY.md"),
      {
        category: "personal",
        type: "ticketed",
        status: "done",
        created: D(1),
        updated: D(5),
        layout: "file",
      },
      "stray body",
    );
    const data = collectPerfReviewData(root, {
      category: "work",
      from: D(1),
      to: D(30),
    });
    assert.equal(data.entries.length, 0);
    assert.equal(data.warnings.length, 1);
    assert.match(data.warnings[0], /STRAY.*frontmatter category mismatch/);
  });
});
