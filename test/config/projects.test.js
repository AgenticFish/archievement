// test/config/projects.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import {
  readProjectsConfig,
  writeProjectsConfig,
  matchProject,
  addProject,
  addIgnore,
} from "../../lib/config/projects.js";

test("readProjectsConfig returns empty when file missing", async () => {
  await withTmpDir(async (dir) => {
    const cfg = readProjectsConfig(join(dir, "missing.yml"));
    assert.deepEqual(cfg, { projects: [], ignore: [] });
  });
});

test("matchProject finds entry by git-remote", async () => {
  const cfg = {
    projects: [
      {
        match: { type: "git-remote", url: "github.com/me/project-a" },
        slug: "project-a",
        category: "work",
        language: "en",
      },
    ],
    ignore: [],
  };
  const hit = matchProject(cfg, { remote: "github.com/me/project-a", cwd: "/tmp/whatever" });
  assert.equal(hit.kind, "match");
  assert.equal(hit.project.slug, "project-a");
});

test("matchProject finds entry by absolute path when no git remote", async () => {
  const cfg = {
    projects: [
      {
        match: { type: "path", path: "/Users/foo/work/no-git-project" },
        slug: "no-git-project",
        category: "personal",
      },
    ],
    ignore: [],
  };
  const hit = matchProject(cfg, { remote: null, cwd: "/Users/foo/work/no-git-project" });
  assert.equal(hit.kind, "match");
  assert.equal(hit.project.slug, "no-git-project");
});

test("matchProject reports 'ignored' when cwd is in ignore list", async () => {
  const cfg = {
    projects: [],
    ignore: [{ match: { type: "path", path: "/tmp/ignored" } }],
  };
  const hit = matchProject(cfg, { remote: null, cwd: "/tmp/ignored" });
  assert.equal(hit.kind, "ignored");
});

test("matchProject reports 'unknown' when nothing matches", async () => {
  const cfg = { projects: [], ignore: [] };
  const hit = matchProject(cfg, { remote: "github.com/me/new", cwd: "/tmp/new" });
  assert.equal(hit.kind, "unknown");
});

test("addProject appends and writeProjectsConfig round-trips", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "projects.yml");
    let cfg = readProjectsConfig(path);
    cfg = addProject(cfg, {
      match: { type: "git-remote", url: "github.com/me/new" },
      slug: "new",
      category: "work",
    });
    writeProjectsConfig(path, cfg);
    const reloaded = readProjectsConfig(path);
    assert.equal(reloaded.projects.length, 1);
    assert.equal(reloaded.projects[0].slug, "new");
  });
});

test("addIgnore appends to ignore list", () => {
  const cfg = { projects: [], ignore: [] };
  const next = addIgnore(cfg, { match: { type: "path", path: "/tmp/x" } });
  assert.equal(next.ignore.length, 1);
  assert.equal(next.ignore[0].match.path, "/tmp/x");
});
