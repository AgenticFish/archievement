// test/reports/completion.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCompletion } from "../../lib/reports/completion.js";

const entry = (over) => ({
  pointer: { category: over.category ?? "work", type: over.type ?? "ticketed", id: over.id },
  layout: "dir",
  path: "/dev/null",
  data: {
    category: over.category ?? "work",
    type: over.type ?? "ticketed",
    status: "done",
    updated: over.updated,
    prs: over.prs,
    promoted_to: over.promoted_to,
    ticket_id: over.id,
    ...over.data,
  },
});

test("buildCompletion lists done entries within range, grouped by category × type", () => {
  const entries = [
    entry({ id: "PROJ-100", updated: "2026-04-29", prs: [{ id: 1 }, { id: 2 }, { id: 3 }] }),
    entry({ id: "PROJ-105", updated: "2026-05-12", prs: [{ id: 4 }] }),
    entry({ id: "outside", updated: "2026-01-01" }),
  ];
  const md = buildCompletion(entries, { from: "2026-04-23", to: "2026-05-23" });
  assert.match(md, /Completed.*2026-04-23\.\.2026-05-23/);
  assert.match(md, /## Work/);
  assert.match(md, /### Ticketed \(2\)/);
  assert.match(md, /PROJ-100.*done 2026-04-29.*3 PRs/);
  assert.doesNotMatch(md, /outside/);
});

test("buildCompletion surfaces promotions under 'Promoted from idea'", () => {
  const entries = [
    entry({
      category: "personal",
      type: "idea",
      id: "spark",
      updated: "2026-05-08",
      promoted_to: "personal/unticketed/spark-poc",
    }),
  ];
  const md = buildCompletion(entries, { from: "2026-05-01", to: "2026-05-23" });
  assert.match(md, /## Personal/);
  assert.match(md, /### Promoted from idea \(1\)/);
  assert.match(md, /spark.*→.*personal\/unticketed\/spark-poc.*2026-05-08/);
});
