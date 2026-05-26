// lib/config/plugin.js
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir as realHomedir } from "node:os";
import yaml from "js-yaml";

/**
 * @typedef {{ pluginDataDir?: string }} PluginPathOpts
 * @typedef {{ archievement_root: string | null }} PluginConfig
 * @typedef {{
 *   pluginConfigPath?: string,
 *   legacyRcPath?: string,
 *   homedir?: () => string,
 * }} ResolveOpts
 */

/**
 * Resolve the absolute path of the plugin's config file. The config lives at
 * `${CLAUDE_PLUGIN_DATA}/config.yml` — `CLAUDE_PLUGIN_DATA` is the env var
 * Claude Code (>= 2.1.78) injects into plugin subprocesses.
 *
 * @param {PluginPathOpts} [opts]
 * @returns {string}
 */
export function getPluginConfigPath(opts = {}) {
  const dataDir = opts.pluginDataDir ?? process.env.CLAUDE_PLUGIN_DATA;
  if (!dataDir) {
    throw new Error(
      "CLAUDE_PLUGIN_DATA is not set. The archievement plugin requires Claude Code >= 2.1.78.",
    );
  }
  return join(dataDir, "config.yml");
}

/**
 * Read the plugin config file. Missing file or missing field => null root.
 *
 * @param {string} [path] Absolute path; defaults to getPluginConfigPath().
 * @returns {PluginConfig}
 */
export function readPluginConfig(path) {
  const target = path ?? getPluginConfigPath();
  if (!existsSync(target)) return { archievement_root: null };
  const parsed = yaml.load(readFileSync(target, "utf8")) ?? {};
  return { archievement_root: parsed.archievement_root ?? null };
}

/**
 * Write the plugin config file, creating its parent directory if needed.
 *
 * @param {string} path Absolute path to the config file.
 * @param {{ archievement_root: string }} config
 */
export function writePluginConfig(path, config) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, yaml.dump(config), "utf8");
}

/**
 * Resolve archievement_root.
 *
 * Returns the configured root path, or null if archievement has not been set
 * up yet. Performs a one-time migration when a legacy `~/.archievementrc`
 * pointer file is present and no plugin config exists: writes the new config
 * and unlinks the legacy file.
 *
 * Callers MUST treat null as "user has not run /archievement:setup yet" — they
 * must not fall back to a default path or search the filesystem.
 *
 * @param {ResolveOpts} [opts]
 * @returns {string | null}
 */
export function resolveArchievementRoot(opts = {}) {
  const homedirFn = opts.homedir ?? realHomedir;
  const pluginConfigPath = opts.pluginConfigPath ?? getPluginConfigPath();
  const fromConfig = readPluginConfig(pluginConfigPath).archievement_root;
  if (fromConfig) return fromConfig;

  const legacyRcPath = opts.legacyRcPath ?? join(homedirFn(), ".archievementrc");
  if (existsSync(legacyRcPath)) {
    const legacy = readFileSync(legacyRcPath, "utf8").trim();
    if (legacy) {
      writePluginConfig(pluginConfigPath, { archievement_root: legacy });
      unlinkSync(legacyRcPath);
      return legacy;
    }
  }
  return null;
}
