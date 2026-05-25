// test/reports/write.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import { writeReport, makeReportFilename, localTimestamp } from "../../lib/reports/write.js";

test("localTimestamp formats a given Date in local time with zero-padded fields", () => {
  // May = month index 4. Date constructor treats fields as local.
  const d = new Date(2026, 4, 25, 14, 32);
  assert.equal(localTimestamp(d), "2026-05-25T14-32");
});

test("localTimestamp zero-pads single-digit month/day/hour/minute", () => {
  const d = new Date(2026, 0, 5, 9, 7);
  assert.equal(localTimestamp(d), "2026-01-05T09-07");
});

test("makeReportFilename defaults timestamp to localTimestamp() when omitted", () => {
  const name = makeReportFilename({ kind: "summary" });
  assert.match(name, /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-summary\.md$/);
});

test("writeReport defaults timestamp to localTimestamp() when omitted", async () => {
  await withTmpDir(async (root) => {
    const path = writeReport(root, {
      kind: "summary",
      frontmatter: { type: "report", kind: "summary" },
      body: "# Summary\n",
    });
    assert.match(path, /\/reports\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-summary\.md$/);
    assert.ok(existsSync(path));
  });
});

test("makeReportFilename uses timestamp suffix for ordinary kinds", () => {
  const name = makeReportFilename({ kind: "summary", timestamp: "2026-05-23T14-32" });
  assert.equal(name, "2026-05-23T14-32-summary.md");
});

test("makeReportFilename routes perf-review to subdirectory with category suffix", () => {
  const name = makeReportFilename({
    kind: "perf-review",
    timestamp: "2026-05-23T14-32",
    category: "work",
  });
  assert.equal(name, "perf-review/2026-05-23T14-32-work.md");
});

test("writeReport creates the file with given frontmatter and body", async () => {
  await withTmpDir(async (root) => {
    const path = writeReport(root, {
      kind: "summary",
      timestamp: "2026-05-23T14-32",
      frontmatter: {
        type: "report",
        kind: "summary",
        generated: "2026-05-23",
        range: "snapshot",
        language: "zh",
        category_filter: null,
      },
      body: "# Summary\n\nBody.\n",
    });
    assert.ok(path.endsWith("2026-05-23T14-32-summary.md"));
    assert.ok(existsSync(path));
    const content = readFileSync(path, "utf8");
    assert.match(content, /kind: summary/);
    assert.match(content, /# Summary/);
  });
});

test("writeReport with perf-review writes into perf-review subdir", async () => {
  await withTmpDir(async (root) => {
    const path = writeReport(root, {
      kind: "perf-review",
      timestamp: "2026-05-23T14-32",
      category: "work",
      frontmatter: {
        type: "report",
        kind: "perf-review",
        generated: "2026-05-23",
        range: "2025-11-01..2026-04-30",
        language: "en",
        category_filter: "work",
      },
      body: "# Perf review draft.\n",
    });
    assert.ok(path.endsWith("/reports/perf-review/2026-05-23T14-32-work.md"));
    assert.ok(existsSync(path));
  });
});
