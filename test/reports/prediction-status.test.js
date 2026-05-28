// test/reports/prediction-status.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { updateEntryFrontmatter } from "../../lib/entries/update.js";
import { listEntries } from "../../lib/entries/list.js";
import { readFrontmatter, writeFrontmatter } from "../../lib/frontmatter.js";
import {
  renderStatusTable,
  parseStatusTable,
  resolveStatus,
  freshenStatusTable,
  refreshReportFile,
  MissingAnchorsError,
} from "../../lib/reports/prediction-status.js";

const NOW = "2026-05-28";

test("renderStatusTable wraps a well-formed markdown table in anchors", () => {
  const block = renderStatusTable([
    { id: "foo", classification: "small unticketed", status: "todo" },
    {
      id: "bar-baz",
      classification: "needs brainstorm",
      status: "→ personal/unticketed/bar-baz (done)",
    },
  ]);
  assert.match(block, /<!-- archievement:status-table:start -->/);
  assert.match(block, /<!-- archievement:status-table:end -->/);
  assert.match(block, /\| Idea \| Classification \| Status \|/);
  assert.match(block, /\| foo \| small unticketed \| todo \|/);
  assert.match(
    block,
    /\| bar-baz \| needs brainstorm \| → personal\/unticketed\/bar-baz \(done\) \|/,
  );
});

test("parseStatusTable round-trips render output (ignoring status)", () => {
  const block = renderStatusTable([
    { id: "foo", classification: "small unticketed", status: "todo" },
    { id: "bar", classification: "medium unticketed", status: "in-progress" },
  ]);
  const body = `intro\n\n${block}\n\nother prose\n`;
  const result = parseStatusTable(body);
  assert.ok(result);
  assert.deepEqual(result.rows, [
    { id: "foo", classification: "small unticketed" },
    { id: "bar", classification: "medium unticketed" },
  ]);
});

test("parseStatusTable returns null when anchors absent", () => {
  const body = "Some prose with a table:\n\n| a | b |\n| --- | --- |\n| x | y |\n";
  assert.equal(parseStatusTable(body), null);
});

test("resolveStatus: idea/todo returns the bare status", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "foo" },
      layout: "file",
      extras: {},
      body: "",
      now: NOW,
    });
    const entries = listEntries(root, {});
    assert.equal(resolveStatus(entries, "foo"), "todo");
  });
});

test("resolveStatus: promoted idea resolves to → ptr (target_status)", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "foo" },
      layout: "file",
      extras: { promoted_to: "personal/unticketed/foo-impl" },
      body: "",
      now: NOW,
    });
    createEntry(root, {
      pointer: { category: "personal", type: "unticketed", id: "foo-impl" },
      layout: "file",
      extras: {},
      body: "",
      now: NOW,
    });
    updateEntryFrontmatter(
      root,
      { category: "personal", type: "unticketed", id: "foo-impl" },
      { status: "done" },
    );
    const entries = listEntries(root, {});
    assert.equal(resolveStatus(entries, "foo"), "→ personal/unticketed/foo-impl (done)");
  });
});

test("resolveStatus: promoted to nonexistent target → ptr (gone)", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "foo" },
      layout: "file",
      extras: { promoted_to: "personal/unticketed/nonexistent" },
      body: "",
      now: NOW,
    });
    const entries = listEntries(root, {});
    assert.equal(resolveStatus(entries, "foo"), "→ personal/unticketed/nonexistent (gone)");
  });
});

test("resolveStatus: missing slug returns gone", async () => {
  await withTmpDir(async (root) => {
    const entries = listEntries(root, {});
    assert.equal(resolveStatus(entries, "ghost"), "gone");
  });
});

test("freshenStatusTable rewrites status cells, preserves classifications and prose", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "foo" },
      layout: "file",
      extras: {},
      body: "",
      now: NOW,
    });
    updateEntryFrontmatter(
      root,
      { category: "personal", type: "idea", id: "foo" },
      { status: "in-progress" },
    );
    const block = renderStatusTable([
      { id: "foo", classification: "small unticketed", status: "(pending)" },
    ]);
    const body = `# Title\n\nIntro line.\n\n${block}\n\nAfter prose.\n`;
    const out = freshenStatusTable(body, root, { now: NOW });
    assert.match(out, /\| foo \| small unticketed \| in-progress \|/);
    assert.doesNotMatch(out, /\(pending\)/);
    assert.match(out, /Intro line\./);
    assert.match(out, /After prose\./);
  });
});

test("freshenStatusTable throws MissingAnchorsError when anchors absent", () => {
  assert.throws(
    () => freshenStatusTable("no anchors here\n", "/tmp/whatever", { now: NOW }),
    MissingAnchorsError,
  );
});

test("refreshReportFile rewrites table in place, leaving frontmatter and prose untouched", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "foo" },
      layout: "file",
      extras: {},
      body: "",
      now: NOW,
    });
    const block = renderStatusTable([
      { id: "foo", classification: "small unticketed", status: "(pending)" },
    ]);
    const reportBody = `# Prediction\n\nIntro.\n\n${block}\n\nMore prose.\n`;
    const reportPath = join(root, "reports", "2026-05-28-prediction.md");
    writeFrontmatter(
      reportPath,
      { kind: "prediction", created: NOW, lookback_days: 7 },
      reportBody,
    );

    updateEntryFrontmatter(
      root,
      { category: "personal", type: "idea", id: "foo" },
      { status: "done" },
    );

    const result = refreshReportFile(reportPath, root, { now: NOW });
    assert.equal(result.changed, true);
    const { data, body } = readFrontmatter(reportPath);
    assert.equal(data.kind, "prediction");
    assert.equal(data.created, NOW);
    assert.equal(data.lookback_days, 7);
    assert.match(body, /\| foo \| small unticketed \| done \|/);
    assert.doesNotMatch(body, /\(pending\)/);
    assert.match(body, /Intro\./);
    assert.match(body, /More prose\./);
  });
});

test("refreshReportFile reports changed=false when nothing changed", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "foo" },
      layout: "file",
      extras: {},
      body: "",
      now: NOW,
    });
    const entries = listEntries(root, {});
    const status = resolveStatus(entries, "foo");
    const block = renderStatusTable([{ id: "foo", classification: "small unticketed", status }]);
    const reportPath = join(root, "reports", "2026-05-28-prediction.md");
    writeFrontmatter(
      reportPath,
      { kind: "prediction", created: NOW },
      `Intro\n\n${block}\n\nOutro\n`,
    );
    const result = refreshReportFile(reportPath, root, { now: NOW });
    assert.equal(result.changed, false);
  });
});
