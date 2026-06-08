// test/entries/path.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import { withTmpDir } from "../helpers/tmp.js";
import {
  entryFilePath,
  entryDirPath,
  entryIndexPath,
  locateEntry,
  isDirOnlyType,
  slugOf,
  projectOf,
  makeId,
} from "../../lib/entries/path.js";

test("entryFilePath returns flat-file form", () => {
  const p = entryFilePath("/tmp/arch", { category: "work", type: "ticketed", id: "PROJ-1" });
  assert.equal(p, "/tmp/arch/work/ticketed/PROJ-1.md");
});

test("entryDirPath returns directory form", () => {
  const p = entryDirPath("/tmp/arch", { category: "work", type: "ticketed", id: "PROJ-1" });
  assert.equal(p, "/tmp/arch/work/ticketed/PROJ-1");
});

test("entryIndexPath returns index.md inside directory form", () => {
  const p = entryIndexPath("/tmp/arch", { category: "work", type: "ticketed", id: "PROJ-1" });
  assert.equal(p, "/tmp/arch/work/ticketed/PROJ-1/index.md");
});

test("isDirOnlyType is true for learning (because it has materials/)", () => {
  assert.equal(isDirOnlyType("learning"), true);
});

test("isDirOnlyType is false for idea (always file)", () => {
  assert.equal(isDirOnlyType("idea"), false);
});

test("locateEntry finds file form when only file exists", async () => {
  await withTmpDir(async (root) => {
    const target = join(root, "work", "ticketed", "PROJ-1.md");
    mkdirSync(join(root, "work", "ticketed"), { recursive: true });
    writeFileSync(target, "---\ncategory: work\n---\n");
    const located = locateEntry(root, { category: "work", type: "ticketed", id: "PROJ-1" });
    assert.equal(located.layout, "file");
    assert.equal(located.path, target);
  });
});

test("locateEntry finds dir form when only directory exists", async () => {
  await withTmpDir(async (root) => {
    const dir = join(root, "work", "ticketed", "PROJ-2");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.md"), "---\ncategory: work\n---\n");
    const located = locateEntry(root, { category: "work", type: "ticketed", id: "PROJ-2" });
    assert.equal(located.layout, "dir");
    assert.equal(located.path, join(dir, "index.md"));
  });
});

test("locateEntry returns null when neither exists", async () => {
  await withTmpDir(async (root) => {
    const located = locateEntry(root, { category: "work", type: "ticketed", id: "GONE" });
    assert.equal(located, null);
  });
});

test("slugOf: non-ticketed strips only the project segment", () => {
  assert.equal(
    slugOf({ type: "idea", id: "tbd_mcp-transport-stdio-vs-http" }),
    "mcp-transport-stdio-vs-http",
  );
  assert.equal(slugOf({ type: "unticketed", id: "archievement-plugin_find-skill" }), "find-skill");
  assert.equal(slugOf({ type: "learning", id: "tbd_magnifica-humanitas" }), "magnifica-humanitas");
});

test("slugOf: ticketed strips the project segment then the TICKET- prefix", () => {
  assert.equal(
    slugOf({ type: "ticketed", id: "egs-mobile_EGA-5971-voice-refactor" }),
    "voice-refactor",
  );
  assert.equal(
    slugOf({ type: "ticketed", id: "archievement-plugin_PROJ-123-add-foo-bar" }),
    "add-foo-bar",
  );
});

test("slugOf: ticketed slug may itself start with a digit", () => {
  assert.equal(slugOf({ type: "ticketed", id: "egs-mobile_PROJ-123-2023-retro" }), "2023-retro");
});

test("slugOf: ticketed id with no slug suffix returns the bare ticket", () => {
  // project stripped → EGA-5971; ticket-prefix regex needs a trailing slug to strip,
  // finds none, so EGA-5971 is returned unchanged.
  assert.equal(slugOf({ type: "ticketed", id: "egs-mobile_EGA-5971" }), "EGA-5971");
});

test("slugOf: tbd project segment is stripped like any other", () => {
  assert.equal(slugOf({ type: "idea", id: "tbd_foo" }), "foo");
});

test("slugOf: an entry-slug containing hyphens survives intact", () => {
  assert.equal(slugOf({ type: "unticketed", id: "archievement-plugin_a-b-c-d" }), "a-b-c-d");
});

test("projectOf returns the project segment before the first underscore", () => {
  assert.equal(projectOf({ id: "archievement-plugin_find-skill" }), "archievement-plugin");
  assert.equal(projectOf({ id: "egs-mobile_EGA-5971-voice-refactor" }), "egs-mobile");
});

test("projectOf returns 'tbd' for the unclassified placeholder", () => {
  assert.equal(projectOf({ id: "tbd_mcp-transport-stdio-vs-http" }), "tbd");
});

test("projectOf returns the project even when the entry-slug has hyphens", () => {
  assert.equal(projectOf({ id: "archievement-plugin_a-b-c-d" }), "archievement-plugin");
});

test("makeId joins project and entry slug with a single underscore", () => {
  assert.equal(makeId("egs-mobile", "EGA-5971"), "egs-mobile_EGA-5971");
  assert.equal(makeId("archievement-plugin", "find-skill"), "archievement-plugin_find-skill");
});

test("makeId defaults a falsy project to the tbd placeholder", () => {
  assert.equal(makeId("", "foo"), "tbd_foo");
  assert.equal(makeId(null, "foo"), "tbd_foo");
  assert.equal(makeId(undefined, "foo"), "tbd_foo");
});

test("makeId rejects an underscore in either segment", () => {
  assert.throws(() => makeId("ar_chievement", "foo"), /underscore/);
  assert.throws(() => makeId("archievement-plugin", "foo_bar"), /underscore/);
});

test("makeId round-trips through projectOf and slugOf for a non-ticketed id", () => {
  const id = makeId("archievement-plugin", "find-skill");
  assert.equal(projectOf({ id }), "archievement-plugin");
  assert.equal(slugOf({ type: "unticketed", id }), "find-skill");
});

test("slugOf preservation holds across a project change (promote graduation)", () => {
  // tbd_foo (idea) graduates to archievement-plugin_foo (unticketed):
  // the project segment changes but the entry-slug is preserved, so promote's
  // slugOf(from) === slugOf(to) check passes.
  const from = { type: "idea", id: "tbd_foo" };
  const to = { type: "unticketed", id: "archievement-plugin_foo" };
  assert.equal(slugOf(from), slugOf(to));
  assert.equal(slugOf(from), "foo");
});

test("slugOf preservation holds when an idea graduates to a ticket", () => {
  // tbd_voice-refactor (idea) → egs-mobile_EGA-5971-voice-refactor (ticketed):
  // project filled in AND a ticket prefix added; entry-slug still 'voice-refactor'.
  const from = { type: "idea", id: "tbd_voice-refactor" };
  const to = { type: "ticketed", id: "egs-mobile_EGA-5971-voice-refactor" };
  assert.equal(slugOf(from), slugOf(to));
  assert.equal(slugOf(from), "voice-refactor");
});
