// test/reports/write.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import { writeReport, makeReportFilename } from "../../lib/reports/write.js";

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
