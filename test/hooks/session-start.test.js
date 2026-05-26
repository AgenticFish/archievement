// test/hooks/session-start.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import { runSessionStart } from "../../lib/hooks/session-start.js";
import { writePluginConfig } from "../../lib/config/plugin.js";
import { writeProjectsConfig } from "../../lib/config/projects.js";
import { createEntry } from "../../lib/entries/create.js";

const TODAY = "2026-05-23";

test("runSessionStart returns empty additionalContext when archievement is not set up", async () => {
  await withTmpDir(async (tmpHome) => {
    const result = await runSessionStart({
      cwd: tmpHome,
      now: TODAY,
      pluginConfigPath: join(tmpHome, "plugin-data", "config.yml"),
      legacyRcPath: join(tmpHome, ".archievementrc"),
      getProjectProbe: () => ({ remote: null, cwd: tmpHome }),
    });
    assert.equal(result.additionalContext, "");
  });
});

test("runSessionStart injects 'unregistered' when project not in projects.yml", async () => {
  await withTmpDir(async (tmpHome) => {
    await withTmpDir(async (root) => {
      const pluginConfigPath = join(tmpHome, "plugin-data", "config.yml");
      writePluginConfig(pluginConfigPath, { archievement_root: root });
      mkdirSync(join(root, "config"), { recursive: true });
      writeProjectsConfig(join(root, "config", "projects.yml"), { projects: [], ignore: [] });
      const result = await runSessionStart({
        cwd: "/some/random/path",
        now: TODAY,
        pluginConfigPath,
        legacyRcPath: join(tmpHome, ".archievementrc"),
        getProjectProbe: () => ({ remote: "github.com/me/new", cwd: "/some/random/path" }),
      });
      assert.match(result.additionalContext, /<archievement-context>/);
      assert.match(result.additionalContext, /unregistered project/);
    });
  });
});

test("runSessionStart injects active entries when project is registered", async () => {
  await withTmpDir(async (tmpHome) => {
    await withTmpDir(async (root) => {
      const pluginConfigPath = join(tmpHome, "plugin-data", "config.yml");
      writePluginConfig(pluginConfigPath, { archievement_root: root });
      mkdirSync(join(root, "config"), { recursive: true });
      writeProjectsConfig(join(root, "config", "projects.yml"), {
        projects: [
          {
            match: { type: "git-remote", url: "github.com/me/project-a" },
            slug: "project-a",
            category: "work",
          },
        ],
        ignore: [],
      });
      createEntry(root, {
        pointer: { category: "work", type: "ticketed", id: "PROJ-1" },
        layout: "dir",
        extras: { ticket_id: "PROJ-1", project: "project-a" },
        body: "",
        now: TODAY,
      });
      const result = await runSessionStart({
        cwd: "/wherever",
        now: TODAY,
        pluginConfigPath,
        legacyRcPath: join(tmpHome, ".archievementrc"),
        getProjectProbe: () => ({ remote: "github.com/me/project-a", cwd: "/wherever" }),
      });
      assert.match(result.additionalContext, /project: project-a/);
      assert.match(result.additionalContext, /category: work/);
      assert.match(result.additionalContext, /PROJ-1 \(todo\)/);
    });
  });
});

test("runSessionStart stays silent for explicitly-ignored cwd", async () => {
  await withTmpDir(async (tmpHome) => {
    await withTmpDir(async (root) => {
      const pluginConfigPath = join(tmpHome, "plugin-data", "config.yml");
      writePluginConfig(pluginConfigPath, { archievement_root: root });
      mkdirSync(join(root, "config"), { recursive: true });
      writeProjectsConfig(join(root, "config", "projects.yml"), {
        projects: [],
        ignore: [{ match: { type: "path", path: "/tmp/ignored" } }],
      });
      const result = await runSessionStart({
        cwd: "/tmp/ignored",
        now: TODAY,
        pluginConfigPath,
        legacyRcPath: join(tmpHome, ".archievementrc"),
        getProjectProbe: () => ({ remote: null, cwd: "/tmp/ignored" }),
      });
      assert.equal(result.additionalContext, "");
    });
  });
});
