// test/entries/list.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { updateEntryFrontmatter } from "../../lib/entries/update.js";
import { listEntries } from "../../lib/entries/list.js";

const DATE = (d) => `2026-05-${String(d).padStart(2, "0")}`;

async function seed(root) {
  createEntry(root, {
    pointer: { category: "work", type: "ticketed", id: "PROJ-1" },
    layout: "dir",
    extras: { ticket_id: "PROJ-1", project: "project-a" },
    body: "",
    now: DATE(1),
  });
  createEntry(root, {
    pointer: { category: "work", type: "ticketed", id: "PROJ-2" },
    layout: "file",
    extras: { ticket_id: "PROJ-2", project: "project-a" },
    body: "",
    now: DATE(2),
  });
  createEntry(root, {
    pointer: { category: "personal", type: "idea", id: "spark" },
    layout: "file",
    extras: { seed_date: DATE(3) },
    body: "",
    now: DATE(3),
  });
  updateEntryFrontmatter(
    root,
    { category: "work", type: "ticketed", id: "PROJ-2" },
    { status: "in-progress", updated: DATE(10) },
  );
  updateEntryFrontmatter(
    root,
    { category: "personal", type: "idea", id: "spark" },
    { status: "done", updated: DATE(20) },
  );
}

test("listEntries returns all entries when no filter", async () => {
  await withTmpDir(async (root) => {
    await seed(root);
    const all = listEntries(root, {});
    assert.equal(all.length, 3);
  });
});

test("listEntries filters by category", async () => {
  await withTmpDir(async (root) => {
    await seed(root);
    const work = listEntries(root, { category: "work" });
    assert.equal(work.length, 2);
    const personal = listEntries(root, { category: "personal" });
    assert.equal(personal.length, 1);
  });
});

test("listEntries filters by type", async () => {
  await withTmpDir(async (root) => {
    await seed(root);
    const tickets = listEntries(root, { type: "ticketed" });
    assert.equal(tickets.length, 2);
    const ideas = listEntries(root, { type: "idea" });
    assert.equal(ideas.length, 1);
  });
});

test("listEntries filters by status", async () => {
  await withTmpDir(async (root) => {
    await seed(root);
    const todo = listEntries(root, { status: "todo" });
    assert.equal(todo.length, 1);
    assert.equal(todo[0].pointer.id, "PROJ-1");
    const done = listEntries(root, { status: "done" });
    assert.equal(done.length, 1);
    assert.equal(done[0].pointer.id, "spark");
  });
});

test("listEntries filters by updatedSince", async () => {
  await withTmpDir(async (root) => {
    await seed(root);
    const recent = listEntries(root, { updatedSince: DATE(15) });
    assert.equal(recent.length, 1);
    assert.equal(recent[0].pointer.id, "spark");
  });
});

test("listEntries filters by project", async () => {
  await withTmpDir(async (root) => {
    await seed(root);
    const a = listEntries(root, { project: "project-a" });
    assert.equal(a.length, 2);
  });
});
