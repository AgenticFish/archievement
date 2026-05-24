// test/git.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { withTmpDir } from "./helpers/tmp.js";
import { normalizeGitRemote, getProjectProbe } from "../lib/git.js";

test("normalizeGitRemote handles SSH-style URLs", () => {
  assert.equal(normalizeGitRemote("git@github.com:foo/bar.git"), "github.com/foo/bar");
});

test("normalizeGitRemote handles HTTPS URLs", () => {
  assert.equal(normalizeGitRemote("https://github.com/foo/bar.git"), "github.com/foo/bar");
});

test("normalizeGitRemote strips .git suffix when missing", () => {
  assert.equal(normalizeGitRemote("https://github.com/foo/bar"), "github.com/foo/bar");
});

test("normalizeGitRemote handles trailing slash", () => {
  assert.equal(normalizeGitRemote("https://github.com/foo/bar/"), "github.com/foo/bar");
});

test("normalizeGitRemote returns null for empty/garbage input", () => {
  assert.equal(normalizeGitRemote(""), null);
  assert.equal(normalizeGitRemote(null), null);
});

test("getProjectProbe returns normalized remote inside a git repo", async () => {
  await withTmpDir(async (dir) => {
    execSync("git init", { cwd: dir });
    execSync("git remote add origin git@github.com:me/sample.git", { cwd: dir });
    const probe = getProjectProbe(dir);
    assert.equal(probe.remote, "github.com/me/sample");
    assert.equal(probe.cwd, dir);
  });
});

test("getProjectProbe returns null remote outside a git repo", async () => {
  await withTmpDir(async (dir) => {
    const probe = getProjectProbe(dir);
    assert.equal(probe.remote, null);
    assert.equal(probe.cwd, dir);
  });
});
