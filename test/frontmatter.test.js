// test/frontmatter.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import { withTmpDir } from "./helpers/tmp.js";
import {
  readFrontmatter,
  writeFrontmatter,
  updateFrontmatter,
  appendBody,
} from "../lib/frontmatter.js";

test("readFrontmatter returns frontmatter and body separately", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "entry.md");
    writeFileSync(path, "---\ncategory: work\nstatus: todo\n---\n\n# Title\n\nBody text.\n");
    const { data, body } = readFrontmatter(path);
    assert.equal(data.category, "work");
    assert.equal(data.status, "todo");
    assert.match(body, /Body text/);
  });
});

test("readFrontmatter on file with no frontmatter returns empty data and full body", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "plain.md");
    writeFileSync(path, "# Just markdown\n\nNo frontmatter.\n");
    const { data, body } = readFrontmatter(path);
    assert.deepEqual(data, {});
    assert.match(body, /Just markdown/);
  });
});

test("writeFrontmatter writes a parseable file", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "out.md");
    writeFrontmatter(path, { category: "personal", status: "in-progress" }, "# Hello\n");
    const { data, body } = readFrontmatter(path);
    assert.equal(data.category, "personal");
    assert.match(body, /# Hello/);
  });
});

test("updateFrontmatter merges fields and preserves body", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "entry.md");
    writeFrontmatter(path, { category: "work", status: "todo" }, "# Title\n\nBody\n");
    updateFrontmatter(path, { status: "in-progress", updated: "2026-05-23" });
    const { data, body } = readFrontmatter(path);
    assert.equal(data.category, "work");
    assert.equal(data.status, "in-progress");
    assert.equal(data.updated, "2026-05-23");
    assert.match(body, /Body/);
  });
});

test("appendBody adds content to the end of the body, preserving frontmatter", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "entry.md");
    writeFrontmatter(path, { category: "work" }, "# Title\n\nOriginal.\n");
    appendBody(path, "\n## 2026-05-23\n\nNew section.\n");
    const { data, body } = readFrontmatter(path);
    assert.equal(data.category, "work");
    assert.match(body, /Original/);
    assert.match(body, /New section/);
    // order: original then new
    assert.ok(body.indexOf("Original") < body.indexOf("New section"));
  });
});

test("appendBody throws when text is not a string and leaves the file unchanged", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "entry.md");
    writeFrontmatter(path, { category: "work" }, "# Title\n\nOriginal.\n");
    const before = readFileSync(path, "utf8");
    for (const bad of [undefined, null, 0, false, {}, []]) {
      assert.throws(() => appendBody(path, bad), /appendBody.*string/i);
    }
    assert.equal(readFileSync(path, "utf8"), before);
  });
});
