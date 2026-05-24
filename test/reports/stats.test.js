// test/reports/stats.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAnchors } from "../../lib/reports/stats.js";

const entry = (overrides) => ({
  pointer: { category: "work", type: "ticketed", id: overrides.id ?? "X" },
  layout: "dir",
  path: "/dev/null",
  data: {
    category: "work",
    type: "ticketed",
    status: "done",
    created: "2026-04-01",
    updated: "2026-04-08",
    prs: [],
    ...overrides,
  },
});

test("computeAnchors counts tickets closed in range", () => {
  const entries = [
    entry({ id: "A", updated: "2026-04-08" }),
    entry({ id: "B", updated: "2026-04-15" }),
    entry({ id: "C", status: "in-progress", updated: "2026-04-30" }),
  ];
  const anchors = computeAnchors(entries, { from: "2026-04-01", to: "2026-04-30" });
  assert.equal(anchors.ticketsClosed, 2);
});

test("computeAnchors counts PRs across done ticketed entries in range", () => {
  const entries = [
    entry({
      id: "A",
      updated: "2026-04-08",
      prs: [{ id: 1 }, { id: 2 }],
    }),
    entry({
      id: "B",
      updated: "2026-04-15",
      prs: [{ id: 3 }],
    }),
  ];
  const anchors = computeAnchors(entries, { from: "2026-04-01", to: "2026-04-30" });
  assert.equal(anchors.prsMerged, 3);
});

test("computeAnchors computes average days for done tickets only", () => {
  const entries = [
    entry({ id: "A", created: "2026-04-01", updated: "2026-04-08" }), // 7 days
    entry({ id: "B", created: "2026-04-01", updated: "2026-04-11" }), // 10 days
    entry({ id: "C", status: "in-progress", created: "2026-04-01", updated: "2026-04-20" }),
  ];
  const anchors = computeAnchors(entries, { from: "2026-04-01", to: "2026-04-30" });
  assert.equal(anchors.avgDaysToDone, 8.5);
});

test("computeAnchors returns zero stats on empty list", () => {
  const anchors = computeAnchors([], { from: "2026-04-01", to: "2026-04-30" });
  assert.deepEqual(anchors, { ticketsClosed: 0, prsMerged: 0, avgDaysToDone: null });
});
