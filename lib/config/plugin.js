// lib/config/plugin.js
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import yaml from "js-yaml";

/**
 * @typedef {{ type: "git-remote", url: string } | { type: "path", path: string }} Matcher
 * @typedef {{ match: Matcher, slug: string, category: "work" | "personal", language?: string }} ProjectEntry
 * @typedef {{ match: Matcher }} IgnoreEntry
 * @typedef {{ remote: string | null, cwd: string }} Probe
 * @typedef {{ kind: "match", project: ProjectEntry } | { kind: "ignored" } | { kind: "unknown" }} MatchResult
 *
 * @typedef {{
 *   archievement_root: string | null,
 *   default_language: string,
 *   stale_days: number,
 *   languages_known: string[],
 *   projects: ProjectEntry[],
 *   ignore: IgnoreEntry[],
 * }} PluginConfig
 *
 * @typedef {{ pluginDataDir?: string }} PluginPathOpts
 * @typedef {{ pluginConfigPath?: string }} ConfigOpts
 */

/**
 * Default plugin config. `archievement_root: null` is the "not set up" signal.
 */
export const DEFAULT_CONFIG = Object.freeze({
  archievement_root: null,
  default_language: "en",
  stale_days: 21,
  languages_known: [],
  projects: [],
  ignore: [],
});

// --- Path / file primitives -----------------------------------------------

/**
 * Resolve the absolute path of the plugin's config file. The config lives at
 * `${CLAUDE_PLUGIN_DATA}/config.yml` — `CLAUDE_PLUGIN_DATA` is the env var
 * Claude Code (>= 2.1.78) injects into hook subprocesses. For Bash-tool
 * subprocesses (where the env var is NOT injected but `${CLAUDE_PLUGIN_DATA}`
 * IS template-substituted at SKILL.md load time), callers pass
 * `pluginDataDir` explicitly.
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
 * Write the full plugin config to disk, creating its parent directory if
 * needed.
 *
 * @param {ConfigOpts} opts Path-injection options (only `pluginConfigPath` is used here).
 * @param {PluginConfig} config
 */
export function saveConfig(opts, config) {
  const target = opts.pluginConfigPath ?? getPluginConfigPath();
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, yaml.dump(config), "utf8");
}

// --- loadConfig (the main read path) --------------------------------------

/**
 * Load the unified plugin config from `${CLAUDE_PLUGIN_DATA}/config.yml`,
 * returning the full config with defaults applied for any missing field.
 * An absent file yields all defaults (`archievement_root: null` = not set up).
 *
 * @param {ConfigOpts} [opts]
 * @returns {PluginConfig}
 */
export function loadConfig(opts = {}) {
  const pluginConfigPath = opts.pluginConfigPath ?? getPluginConfigPath();
  const onDisk = existsSync(pluginConfigPath)
    ? (yaml.load(readFileSync(pluginConfigPath, "utf8")) ?? {})
    : {};

  return {
    archievement_root: onDisk.archievement_root ?? null,
    default_language: onDisk.default_language ?? DEFAULT_CONFIG.default_language,
    stale_days:
      typeof onDisk.stale_days === "number" ? onDisk.stale_days : DEFAULT_CONFIG.stale_days,
    languages_known: Array.isArray(onDisk.languages_known) ? onDisk.languages_known : [],
    projects: Array.isArray(onDisk.projects) ? onDisk.projects : [],
    ignore: Array.isArray(onDisk.ignore) ? onDisk.ignore : [],
  };
}

/**
 * Convenience wrapper: returns the configured archievement root, or null if
 * archievement has not been set up yet. Callers MUST treat null as "user has
 * not run /archievement:setup yet" — they must not fall back to a default
 * path or search the filesystem.
 *
 * @param {ConfigOpts} [opts]
 * @returns {string | null}
 */
export function resolveArchievementRoot(opts = {}) {
  return loadConfig(opts).archievement_root;
}

// --- Pure transforms ------------------------------------------------------

/**
 * Match a probe against the config's projects + ignore lists.
 *
 * @param {{ projects: ProjectEntry[], ignore: IgnoreEntry[] }} config
 * @param {Probe} probe
 * @returns {MatchResult}
 */
export function matchProject(config, probe) {
  for (const proj of config.projects) {
    if (matcherMatches(proj.match, probe)) {
      return { kind: "match", project: proj };
    }
  }
  for (const ig of config.ignore) {
    if (matcherMatches(ig.match, probe)) {
      return { kind: "ignored" };
    }
  }
  return { kind: "unknown" };
}

function matcherMatches(matcher, probe) {
  if (matcher.type === "git-remote") {
    return probe.remote !== null && matcher.url === probe.remote;
  }
  if (matcher.type === "path") {
    return matcher.path === probe.cwd;
  }
  return false;
}

/**
 * Pure: append a project entry to the config, returning a new object.
 *
 * @template {{ projects: ProjectEntry[] }} T
 * @param {T} config
 * @param {ProjectEntry} entry
 * @returns {T}
 */
export function addProject(config, entry) {
  return { ...config, projects: [...config.projects, entry] };
}

/**
 * Pure: append an ignore entry to the config, returning a new object.
 *
 * @template {{ ignore: IgnoreEntry[] }} T
 * @param {T} config
 * @param {IgnoreEntry} entry
 * @returns {T}
 */
export function addIgnore(config, entry) {
  return { ...config, ignore: [...config.ignore, entry] };
}

/**
 * Pure: merge `patch` into the project whose slug matches `slug`, returning a
 * new config. Fields in `patch` replace the matching project's fields; include
 * `slug` in the patch to rename. No matching slug → config returned unchanged.
 *
 * @template {{ projects: ProjectEntry[] }} T
 * @param {T} config
 * @param {string} slug
 * @param {Partial<ProjectEntry>} patch
 * @returns {T}
 */
export function updateProject(config, slug, patch) {
  return {
    ...config,
    projects: config.projects.map((p) => (p.slug === slug ? { ...p, ...patch } : p)),
  };
}

/**
 * Pure: return a new config with the slug-matching project removed. No match →
 * config returned unchanged (an empty filter result is still a new array).
 *
 * @template {{ projects: ProjectEntry[] }} T
 * @param {T} config
 * @param {string} slug
 * @returns {T}
 */
export function removeProject(config, slug) {
  return { ...config, projects: config.projects.filter((p) => p.slug !== slug) };
}

/**
 * Pure: return a new config with every ignore entry that matches `probe`
 * removed — the exact inverse of the `kind: "ignored"` result from
 * `matchProject`. No match → config returned unchanged.
 *
 * @template {{ ignore: IgnoreEntry[] }} T
 * @param {T} config
 * @param {Probe} probe
 * @returns {T}
 */
export function removeIgnore(config, probe) {
  return { ...config, ignore: config.ignore.filter((ig) => !matcherMatches(ig.match, probe)) };
}

/**
 * Pure: append a language code to languages_known if not already present.
 *
 * @template {{ languages_known: string[] }} T
 * @param {T} config
 * @param {string} lang
 * @returns {T}
 */
export function rememberLanguage(config, lang) {
  if (config.languages_known.includes(lang)) return config;
  return { ...config, languages_known: [...config.languages_known, lang] };
}
