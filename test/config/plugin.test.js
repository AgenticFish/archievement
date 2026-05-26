// test/config/plugin.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { withTmpDir } from "../helpers/tmp.js";
import {
  getPluginConfigPath,
  loadConfig,
  saveConfig,
  resolveArchievementRoot,
  matchProject,
  addProject,
  addIgnore,
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
      legacyRcPath: join(dir, ".archievementrc"),
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
      legacyRcPath: join(dir, ".archievementrc"),
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
      legacyRcPath: join(dir, ".archievementrc"),
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
      legacyRcPath: join(dir, ".archievementrc"),
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
      legacyRcPath: join(dir, ".archievementrc"),
    });
    assert.equal(root, "/Users/jane/archievement");
  });
});

// --- migration: legacy ~/.archievementrc ----------------------------------

test("loadConfig migrates the legacy .archievementrc pointer", async () => {
  await withTmpDir(async (dir) => {
    const legacyRcPath = join(dir, ".archievementrc");
    const configPath = join(dir, "plugin-data", "config.yml");
    const root = join(dir, "archive");
    mkdirSync(root, { recursive: true });
    writeFileSync(legacyRcPath, `${root}\n`);

    const cfg = loadConfig({ pluginConfigPath: configPath, legacyRcPath });

    assert.equal(cfg.archievement_root, root);
    assert.equal(existsSync(legacyRcPath), false, "legacy rc should be removed");
    assert.ok(existsSync(configPath), "new config file should be written");
    const written = yaml.load(readFileSync(configPath, "utf8"));
    assert.equal(written.archievement_root, root);
  });
});

test("loadConfig leaves legacy rc untouched when plugin config already has a root", async () => {
  await withTmpDir(async (dir) => {
    const legacyRcPath = join(dir, ".archievementrc");
    const configPath = join(dir, "config.yml");
    writeFileSync(legacyRcPath, "/should/be/ignored\n");
    saveConfig(
      { pluginConfigPath: configPath },
      { ...DEFAULT_CONFIG, archievement_root: "/already/configured" },
    );

    const cfg = loadConfig({ pluginConfigPath: configPath, legacyRcPath });

    assert.equal(cfg.archievement_root, "/already/configured");
    assert.equal(existsSync(legacyRcPath), true);
  });
});

test("loadConfig treats a whitespace-only legacy rc as empty", async () => {
  await withTmpDir(async (dir) => {
    const legacyRcPath = join(dir, ".archievementrc");
    const configPath = join(dir, "config.yml");
    writeFileSync(legacyRcPath, "   \n\t\n");
    const cfg = loadConfig({ pluginConfigPath: configPath, legacyRcPath });
    assert.equal(cfg.archievement_root, null);
    assert.equal(existsSync(configPath), false);
  });
});

// --- migration: legacy <root>/config/*.yml --------------------------------

test("loadConfig migrates <root>/config/global.yml on first load", async () => {
  await withTmpDir(async (dir) => {
    const root = join(dir, "archive");
    mkdirSync(join(root, "config"), { recursive: true });
    writeFileSync(join(root, "config", "global.yml"), "default_language: zh\nstale_days: 30\n");
    const configPath = join(dir, "plugin-data", "config.yml");
    saveConfig({ pluginConfigPath: configPath }, { ...DEFAULT_CONFIG, archievement_root: root });

    const cfg = loadConfig({
      pluginConfigPath: configPath,
      legacyRcPath: join(dir, ".archievementrc"),
    });

    assert.equal(cfg.default_language, "zh");
    assert.equal(cfg.stale_days, 30);
    assert.equal(existsSync(join(root, "config", "global.yml")), false);
  });
});

test("loadConfig migrates <root>/config/projects.yml", async () => {
  await withTmpDir(async (dir) => {
    const root = join(dir, "archive");
    mkdirSync(join(root, "config"), { recursive: true });
    writeFileSync(
      join(root, "config", "projects.yml"),
      yaml.dump({
        projects: [{ match: { type: "git-remote", url: "x" }, slug: "x", category: "work" }],
        ignore: [{ match: { type: "path", path: "/tmp/y" } }],
      }),
    );
    const configPath = join(dir, "plugin-data", "config.yml");
    saveConfig({ pluginConfigPath: configPath }, { ...DEFAULT_CONFIG, archievement_root: root });

    const cfg = loadConfig({
      pluginConfigPath: configPath,
      legacyRcPath: join(dir, ".archievementrc"),
    });

    assert.equal(cfg.projects.length, 1);
    assert.equal(cfg.projects[0].slug, "x");
    assert.equal(cfg.ignore.length, 1);
    assert.equal(existsSync(join(root, "config", "projects.yml")), false);
  });
});

test("loadConfig migrates <root>/config/user-prefs.yml", async () => {
  await withTmpDir(async (dir) => {
    const root = join(dir, "archive");
    mkdirSync(join(root, "config"), { recursive: true });
    writeFileSync(join(root, "config", "user-prefs.yml"), "languages_known:\n  - zh\n  - en\n");
    const configPath = join(dir, "plugin-data", "config.yml");
    saveConfig({ pluginConfigPath: configPath }, { ...DEFAULT_CONFIG, archievement_root: root });

    const cfg = loadConfig({
      pluginConfigPath: configPath,
      legacyRcPath: join(dir, ".archievementrc"),
    });

    assert.deepEqual(cfg.languages_known, ["zh", "en"]);
    assert.equal(existsSync(join(root, "config", "user-prefs.yml")), false);
  });
});

test("loadConfig removes <root>/config/ entirely after migrating all files", async () => {
  await withTmpDir(async (dir) => {
    const root = join(dir, "archive");
    mkdirSync(join(root, "config"), { recursive: true });
    writeFileSync(join(root, "config", "global.yml"), "default_language: zh\nstale_days: 21\n");
    writeFileSync(join(root, "config", "projects.yml"), "projects: []\nignore: []\n");
    writeFileSync(join(root, "config", "user-prefs.yml"), "languages_known: []\n");
    const configPath = join(dir, "plugin-data", "config.yml");
    saveConfig({ pluginConfigPath: configPath }, { ...DEFAULT_CONFIG, archievement_root: root });

    loadConfig({
      pluginConfigPath: configPath,
      legacyRcPath: join(dir, ".archievementrc"),
    });

    assert.equal(existsSync(join(root, "config")), false, "empty config dir should be removed");
  });
});

test("loadConfig keeps <root>/config/ if it contains unknown files", async () => {
  await withTmpDir(async (dir) => {
    const root = join(dir, "archive");
    mkdirSync(join(root, "config"), { recursive: true });
    writeFileSync(join(root, "config", "global.yml"), "default_language: zh\nstale_days: 21\n");
    writeFileSync(join(root, "config", "user-script.sh"), "echo hi\n");
    const configPath = join(dir, "plugin-data", "config.yml");
    saveConfig({ pluginConfigPath: configPath }, { ...DEFAULT_CONFIG, archievement_root: root });

    loadConfig({
      pluginConfigPath: configPath,
      legacyRcPath: join(dir, ".archievementrc"),
    });

    assert.equal(existsSync(join(root, "config")), true);
    assert.equal(existsSync(join(root, "config", "user-script.sh")), true);
    assert.equal(existsSync(join(root, "config", "global.yml")), false);
  });
});

test("loadConfig is a no-op when already migrated", async () => {
  await withTmpDir(async (dir) => {
    const root = join(dir, "archive");
    mkdirSync(root, { recursive: true });
    const configPath = join(dir, "plugin-data", "config.yml");
    saveConfig(
      { pluginConfigPath: configPath },
      { ...DEFAULT_CONFIG, archievement_root: root, default_language: "zh" },
    );
    const mtimeBefore = readFileSync(configPath, "utf8");

    loadConfig({
      pluginConfigPath: configPath,
      legacyRcPath: join(dir, ".archievementrc"),
    });

    const mtimeAfter = readFileSync(configPath, "utf8");
    assert.equal(
      mtimeAfter,
      mtimeBefore,
      "config file should not be rewritten when no migration needed",
    );
  });
});

test("loadConfig handles full legacy state (rc + <root>/config/*) in one call", async () => {
  await withTmpDir(async (dir) => {
    const root = join(dir, "archive");
    mkdirSync(join(root, "config"), { recursive: true });
    const legacyRcPath = join(dir, ".archievementrc");
    writeFileSync(legacyRcPath, `${root}\n`);
    writeFileSync(join(root, "config", "global.yml"), "default_language: zh\nstale_days: 30\n");
    writeFileSync(join(root, "config", "user-prefs.yml"), "languages_known:\n  - zh\n");
    writeFileSync(join(root, "config", "projects.yml"), "projects: []\nignore: []\n");
    const configPath = join(dir, "plugin-data", "config.yml");

    const cfg = loadConfig({ pluginConfigPath: configPath, legacyRcPath });

    assert.equal(cfg.archievement_root, root);
    assert.equal(cfg.default_language, "zh");
    assert.equal(cfg.stale_days, 30);
    assert.deepEqual(cfg.languages_known, ["zh"]);
    assert.equal(existsSync(legacyRcPath), false);
    assert.equal(existsSync(join(root, "config")), false);
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
      legacyRcPath: join(dir, ".archievementrc"),
    });
    cfg = addProject(cfg, {
      match: { type: "git-remote", url: "github.com/me/new" },
      slug: "new",
      category: "work",
    });
    saveConfig({ pluginConfigPath: configPath }, cfg);
    const reloaded = loadConfig({
      pluginConfigPath: configPath,
      legacyRcPath: join(dir, ".archievementrc"),
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

test("rememberLanguage appends without duplicating", () => {
  const start = { ...DEFAULT_CONFIG, languages_known: ["zh"] };
  const after = rememberLanguage(start, "en");
  assert.deepEqual(after.languages_known, ["zh", "en"]);
  const again = rememberLanguage(after, "zh");
  assert.deepEqual(again.languages_known, ["zh", "en"]);
});
