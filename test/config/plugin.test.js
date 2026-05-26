// test/config/plugin.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { withTmpDir } from "../helpers/tmp.js";
import {
  getPluginConfigPath,
  readPluginConfig,
  writePluginConfig,
  resolveArchievementRoot,
} from "../../lib/config/plugin.js";

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

test("readPluginConfig returns null root when file is missing", async () => {
  await withTmpDir(async (dir) => {
    const cfg = readPluginConfig(join(dir, "missing.yml"));
    assert.deepEqual(cfg, { archievement_root: null });
  });
});

test("readPluginConfig returns null root when file has no archievement_root field", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "config.yml");
    writeFileSync(path, "some_other_field: hello\n");
    const cfg = readPluginConfig(path);
    assert.deepEqual(cfg, { archievement_root: null });
  });
});

test("readPluginConfig reads archievement_root from a valid file", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "config.yml");
    writeFileSync(path, "archievement_root: /Users/jane/archievement\n");
    const cfg = readPluginConfig(path);
    assert.deepEqual(cfg, { archievement_root: "/Users/jane/archievement" });
  });
});

test("readPluginConfig tolerates extra unknown fields (forward-compat)", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "config.yml");
    writeFileSync(path, "archievement_root: /tmp/root\nfuture_field: 42\nnested:\n  key: value\n");
    const cfg = readPluginConfig(path);
    assert.equal(cfg.archievement_root, "/tmp/root");
  });
});

test("writePluginConfig writes a YAML file that round-trips through readPluginConfig", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "nested", "config.yml");
    writePluginConfig(path, { archievement_root: "/Users/jane/archievement" });
    assert.ok(existsSync(path), "parent directory should be auto-created");
    const cfg = readPluginConfig(path);
    assert.deepEqual(cfg, { archievement_root: "/Users/jane/archievement" });
  });
});

test("resolveArchievementRoot returns null when nothing is configured", async () => {
  await withTmpDir(async (dir) => {
    const root = resolveArchievementRoot({
      pluginConfigPath: join(dir, "config.yml"),
      legacyRcPath: join(dir, ".archievementrc"),
    });
    assert.equal(root, null);
  });
});

test("resolveArchievementRoot reads from plugin config when present", async () => {
  await withTmpDir(async (dir) => {
    const configPath = join(dir, "config.yml");
    writePluginConfig(configPath, { archievement_root: "/Users/jane/archievement" });
    const root = resolveArchievementRoot({
      pluginConfigPath: configPath,
      legacyRcPath: join(dir, ".archievementrc"),
    });
    assert.equal(root, "/Users/jane/archievement");
  });
});

test("resolveArchievementRoot migrates from legacy .archievementrc when config is absent", async () => {
  await withTmpDir(async (dir) => {
    const legacyRcPath = join(dir, ".archievementrc");
    const configPath = join(dir, "plugin-data", "config.yml");
    writeFileSync(legacyRcPath, "/Users/jane/archievement\n");

    const root = resolveArchievementRoot({
      pluginConfigPath: configPath,
      legacyRcPath,
    });

    assert.equal(root, "/Users/jane/archievement");
    assert.equal(existsSync(legacyRcPath), false, "legacy rc should be removed after migration");
    assert.ok(existsSync(configPath), "new config file should be written");
    const written = yaml.load(readFileSync(configPath, "utf8"));
    assert.equal(written.archievement_root, "/Users/jane/archievement");
  });
});

test("resolveArchievementRoot does not migrate when plugin config already has a value", async () => {
  await withTmpDir(async (dir) => {
    const legacyRcPath = join(dir, ".archievementrc");
    const configPath = join(dir, "config.yml");
    writeFileSync(legacyRcPath, "/should/be/ignored\n");
    writePluginConfig(configPath, { archievement_root: "/already/configured" });

    const root = resolveArchievementRoot({
      pluginConfigPath: configPath,
      legacyRcPath,
    });

    assert.equal(root, "/already/configured");
    assert.equal(
      existsSync(legacyRcPath),
      true,
      "legacy rc should be left untouched when config wins",
    );
  });
});

test("resolveArchievementRoot treats whitespace-only legacy rc as empty", async () => {
  await withTmpDir(async (dir) => {
    const legacyRcPath = join(dir, ".archievementrc");
    const configPath = join(dir, "config.yml");
    writeFileSync(legacyRcPath, "   \n\t\n");
    const root = resolveArchievementRoot({
      pluginConfigPath: configPath,
      legacyRcPath,
    });
    assert.equal(root, null);
    assert.equal(
      existsSync(configPath),
      false,
      "no config should be written from an empty legacy rc",
    );
  });
});
