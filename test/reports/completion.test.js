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

test("buildCompletion has no 'Promoted from idea' bucket; graduated work shows as its entry", () => {
  const entries = [
    {
      pointer: { category: "personal", type: "unticketed", id: "spark" },
      data: { category: "personal", type: "unticketed", status: "done", updated: "2026-05-10" },
    },
  ];
  const body = buildCompletion(entries, { from: "2026-05-01", to: "2026-05-31" });
  assert.doesNotMatch(body, /Promoted from idea/);
  assert.match(body, /\*\*spark\*\* — done 2026-05-10/);

  // A done idea carrying promoted_to must not surface under any heading
  const ideaEntries = [
    {
      pointer: { category: "work", type: "idea", id: "big-idea" },
      data: {
        category: "work",
        type: "idea",
        status: "done",
        updated: "2026-05-15",
        promoted_to: "work/unticketed/big-idea",
      },
    },
  ];
  const ideaBody = buildCompletion(ideaEntries, { from: "2026-05-01", to: "2026-05-31" });
  assert.doesNotMatch(ideaBody, /Promoted from idea/);
  assert.doesNotMatch(ideaBody, /big-idea/);
});
