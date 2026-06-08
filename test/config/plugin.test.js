// test/config/plugin.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import {
  getPluginConfigPath,
  loadConfig,
  saveConfig,
  resolveArchievementRoot,
  matchProject,
  addProject,
  addIgnore,
  updateProject,
  removeProject,
  removeIgnore,
  rememberLanguage,
  DEFAULT_CONFIG,
} from "../../lib/config/plugin.js";

// --- getPluginConfigPath ---------------------------------------------------

test("getPluginConfigPath uses injected pluginDataDir", () => {
  const path = getPluginConfigPath({ pluginDataDir: "/tmp/fake-plugin-data" });
  assert.equal(path, "/tmp/fake-plugin-data/config.yml");
});

test("getPluginConfigPath reads CLAUDE_PLUGIN_DATA env var", () => {
  const prev = process.env.CLAUDE_PLUGIN_DATA;
  process.env.CLAUDE_PLUGIN_DATA = "/tmp/env-plugin-data";
  try {
    const path = getPluginConfigPath();
    assert.equal(path, "/tmp/env-plugin-data/config.yml");
  } finally {
    if (prev === undefined) delete process.env.CLAUDE_PLUGIN_DATA;
    else process.env.CLAUDE_PLUGIN_DATA = prev;
  }
});

test("getPluginConfigPath throws when env var is unset and no injection", () => {
  const prev = process.env.CLAUDE_PLUGIN_DATA;
  delete process.env.CLAUDE_PLUGIN_DATA;
  try {
    assert.throws(() => getPluginConfigPath(), /CLAUDE_PLUGIN_DATA is not set/);
  } finally {
    if (prev !== undefined) process.env.CLAUDE_PLUGIN_DATA = prev;
  }
});

// --- saveConfig + loadConfig round-trip ------------------------------------

test("loadConfig returns defaults when nothing is configured", async () => {
  await withTmpDir(async (dir) => {
    const cfg = loadConfig({
      pluginConfigPath: join(dir, "config.yml"),
    });
    assert.deepEqual(cfg, { ...DEFAULT_CONFIG, archievement_root: null });
  });
});

test("saveConfig + loadConfig round-trips the full schema", async () => {
  await withTmpDir(async (dir) => {
    const configPath = join(dir, "nested", "config.yml");
    const input = {
      archievement_root: "/Users/jane/archievement",
      default_language: "zh",
      stale_days: 30,
      languages_known: ["zh", "en"],
      projects: [
        {
          match: { type: "git-remote", url: "github.com/jane/proj" },
          slug: "proj",
          category: "work",
          language: "en",
        },
      ],
      ignore: [{ match: { type: "path", path: "/tmp/ignored" } }],
    };
    saveConfig({ pluginConfigPath: configPath }, input);
    assert.ok(existsSync(configPath), "parent directory should be auto-created");
    const loaded = loadConfig({
      pluginConfigPath: configPath,
    });
    assert.deepEqual(loaded, input);
  });
});

test("loadConfig tolerates extra unknown fields (forward-compat)", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "config.yml");
    writeFileSync(path, "archievement_root: /tmp/root\nfuture_field: 42\nnested:\n  key: value\n");
    const cfg = loadConfig({
      pluginConfigPath: path,
    });
    assert.equal(cfg.archievement_root, "/tmp/root");
    assert.equal(cfg.default_language, DEFAULT_CONFIG.default_language);
  });
});

// --- resolveArchievementRoot convenience wrapper ---------------------------

test("resolveArchievementRoot returns null when archievement is not set up", async () => {
  await withTmpDir(async (dir) => {
    const root = resolveArchievementRoot({
      pluginConfigPath: join(dir, "config.yml"),
    });
    assert.equal(root, null);
  });
});

test("resolveArchievementRoot returns the configured root", async () => {
  await withTmpDir(async (dir) => {
    const configPath = join(dir, "config.yml");
    saveConfig(
      { pluginConfigPath: configPath },
      { ...DEFAULT_CONFIG, archievement_root: "/Users/jane/archievement" },
    );
    const root = resolveArchievementRoot({
      pluginConfigPath: configPath,
    });
    assert.equal(root, "/Users/jane/archievement");
  });
});

// --- Pure transforms (moved from projects.js / user-prefs.js) -------------

test("matchProject finds entry by git-remote", () => {
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

test("matchProject finds entry by absolute path when no git remote", () => {
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

test("matchProject reports 'ignored' when cwd is in ignore list", () => {
  const cfg = {
    projects: [],
    ignore: [{ match: { type: "path", path: "/tmp/ignored" } }],
  };
  const hit = matchProject(cfg, { remote: null, cwd: "/tmp/ignored" });
  assert.equal(hit.kind, "ignored");
});

test("matchProject reports 'unknown' when nothing matches", () => {
  const cfg = { projects: [], ignore: [] };
  const hit = matchProject(cfg, { remote: "github.com/me/new", cwd: "/tmp/new" });
  assert.equal(hit.kind, "unknown");
});

test("addProject appends and saveConfig round-trips", async () => {
  await withTmpDir(async (dir) => {
    const configPath = join(dir, "config.yml");
    let cfg = loadConfig({
      pluginConfigPath: configPath,
    });
    cfg = addProject(cfg, {
      match: { type: "git-remote", url: "github.com/me/new" },
      slug: "new",
      category: "work",
    });
    saveConfig({ pluginConfigPath: configPath }, cfg);
    const reloaded = loadConfig({
      pluginConfigPath: configPath,
    });
    assert.equal(reloaded.projects.length, 1);
    assert.equal(reloaded.projects[0].slug, "new");
  });
});

test("addIgnore appends to ignore list", () => {
  const cfg = { ...DEFAULT_CONFIG, projects: [], ignore: [] };
  const next = addIgnore(cfg, { match: { type: "path", path: "/tmp/x" } });
  assert.equal(next.ignore.length, 1);
  assert.equal(next.ignore[0].match.path, "/tmp/x");
});

// --- updateProject / removeProject / removeIgnore -------------------------

test("updateProject merges a patch into the slug-matching project", () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    projects: [
      { match: { type: "path", path: "/p" }, slug: "a", category: "work", language: "en" },
      { match: { type: "path", path: "/q" }, slug: "b", category: "personal" },
    ],
  };
  const next = updateProject(cfg, "a", { category: "personal", language: "zh" });
  assert.equal(next.projects[0].category, "personal");
  assert.equal(next.projects[0].language, "zh");
  assert.equal(next.projects[0].slug, "a", "slug is preserved");
  assert.equal(next.projects[1].category, "personal", "other projects untouched");
});

test("updateProject returns config unchanged when no slug matches", () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    projects: [{ match: { type: "path", path: "/p" }, slug: "a", category: "work" }],
  };
  const next = updateProject(cfg, "missing", { category: "personal" });
  assert.deepEqual(next.projects, cfg.projects);
});

test("removeProject filters out the slug-matching project", () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    projects: [
      { match: { type: "path", path: "/p" }, slug: "a", category: "work" },
      { match: { type: "path", path: "/q" }, slug: "b", category: "personal" },
    ],
  };
  const next = removeProject(cfg, "a");
  assert.equal(next.projects.length, 1);
  assert.equal(next.projects[0].slug, "b");
});

test("removeProject returns config unchanged when no slug matches", () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    projects: [{ match: { type: "path", path: "/p" }, slug: "a", category: "work" }],
  };
  const next = removeProject(cfg, "missing");
  assert.equal(next.projects.length, 1);
});

test("removeIgnore filters the ignore entry matching a path probe", () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    ignore: [
      { match: { type: "path", path: "/tmp/a" } },
      { match: { type: "path", path: "/tmp/b" } },
    ],
  };
  const next = removeIgnore(cfg, { remote: null, cwd: "/tmp/a" });
  assert.equal(next.ignore.length, 1);
  assert.equal(next.ignore[0].match.path, "/tmp/b");
});

test("removeIgnore filters the ignore entry matching a git-remote probe", () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    ignore: [{ match: { type: "git-remote", url: "github.com/me/x" } }],
  };
  const next = removeIgnore(cfg, { remote: "github.com/me/x", cwd: "/anywhere" });
  assert.equal(next.ignore.length, 0);
});

test("removeIgnore returns config unchanged when nothing matches the probe", () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    ignore: [{ match: { type: "path", path: "/tmp/a" } }],
  };
  const next = removeIgnore(cfg, { remote: null, cwd: "/tmp/other" });
  assert.equal(next.ignore.length, 1);
});

test("rememberLanguage appends without duplicating", () => {
  const start = { ...DEFAULT_CONFIG, languages_known: ["zh"] };
  const after = rememberLanguage(start, "en");
  assert.deepEqual(after.languages_known, ["zh", "en"]);
  const again = rememberLanguage(after, "zh");
  assert.deepEqual(again.languages_known, ["zh", "en"]);
});
