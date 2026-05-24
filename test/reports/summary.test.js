// test/reports/summary.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSummary } from "../../lib/reports/summary.js";

const entry = (over) => ({
  pointer: { category: over.category ?? "work", type: over.type ?? "ticketed", id: over.id },
  layout: "dir",
  path: "/dev/null",
  data: {
    category: over.category ?? "work",
    type: over.type ?? "ticketed",
    status: over.status ?? "in-progress",
    updated: over.updated,
    ticket_id: over.id,
    ...over.data,
  },
});

test("buildSummary groups entries by category and type", () => {
  const entries = [
    entry({ id: "PROJ-1", updated: "2026-05-22" }),
    entry({ id: "PROJ-2", updated: "2026-05-23" }),
    entry({
      category: "personal",
      type: "idea",
      status: "todo",
      id: "spark",
      updated: "2026-05-20",
    }),
  ];
  const md = buildSummary(entries, { now: "2026-05-23", staleDays: 21 });
  assert.match(md, /## Work/);
  assert.match(md, /### Ticketed \(2\)/);
  assert.match(md, /PROJ-1/);
  assert.match(md, /PROJ-2/);
  assert.match(md, /## Personal/);
  assert.match(md, /### Ideas \(1\)/);
});

test("buildSummary marks stale entries", () => {
  const entries = [
    entry({ id: "PROJ-FRESH", updated: "2026-05-22" }),
    entry({ id: "PROJ-STALE", updated: "2026-04-01" }),
  ];
  const md = buildSummary(entries, { now: "2026-05-23", staleDays: 21 });
  assert.match(md, /PROJ-FRESH.*1d ago/);
  assert.match(md, /PROJ-STALE.*52d ago.*stale/);
});

test("buildSummary excludes done entries", () => {
  const entries = [
    entry({ id: "PROJ-DONE", status: "done", updated: "2026-05-20" }),
    entry({ id: "PROJ-LIVE", status: "in-progress", updated: "2026-05-20" }),
  ];
  const md = buildSummary(entries, { now: "2026-05-23", staleDays: 21 });
  assert.doesNotMatch(md, /PROJ-DONE/);
  assert.match(md, /PROJ-LIVE/);
});
