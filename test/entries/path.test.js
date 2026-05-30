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

test("slugOf: idea/unticketed/learning id is the slug verbatim", () => {
  assert.equal(slugOf({ type: "idea", id: "foo-bar" }), "foo-bar");
  assert.equal(slugOf({ type: "unticketed", id: "foo-bar" }), "foo-bar");
  assert.equal(slugOf({ type: "learning", id: "magnifica-humanitas" }), "magnifica-humanitas");
});

test("slugOf: ticketed strips the leading TICKET- prefix", () => {
  assert.equal(slugOf({ type: "ticketed", id: "EGA-5971-voice-refactor" }), "voice-refactor");
  assert.equal(slugOf({ type: "ticketed", id: "PROJ-123-add-foo-bar" }), "add-foo-bar");
});

test("slugOf: ticketed slug may itself start with a digit", () => {
  assert.equal(slugOf({ type: "ticketed", id: "PROJ-123-2023-retro" }), "2023-retro");
});

test("slugOf: legacy ticketed id with no slug suffix is returned unchanged", () => {
  assert.equal(slugOf({ type: "ticketed", id: "EGA-5971" }), "EGA-5971");
});
