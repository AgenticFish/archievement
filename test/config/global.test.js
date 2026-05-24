// test/config/global.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import {
  readGlobalConfig,
  writeGlobalConfig,
  DEFAULT_GLOBAL_CONFIG,
} from "../../lib/config/global.js";

test("readGlobalConfig returns defaults when file is missing", async () => {
  await withTmpDir(async (dir) => {
    const cfg = readGlobalConfig(join(dir, "missing.yml"));
    assert.deepEqual(cfg, DEFAULT_GLOBAL_CONFIG);
  });
});

test("readGlobalConfig parses an existing file and merges with defaults", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "global.yml");
    writeFileSync(path, "default_language: fr\nstale_days: 30\n");
    const cfg = readGlobalConfig(path);
    assert.equal(cfg.default_language, "fr");
    assert.equal(cfg.stale_days, 30);
    assert.equal(cfg.archievement_root, DEFAULT_GLOBAL_CONFIG.archievement_root);
  });
});

test("writeGlobalConfig writes a YAML file that round-trips", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "global.yml");
    const input = { default_language: "zh", stale_days: 21, archievement_root: "~/archievement" };
    writeGlobalConfig(path, input);
    const cfg = readGlobalConfig(path);
    assert.deepEqual(cfg, input);
  });
});
