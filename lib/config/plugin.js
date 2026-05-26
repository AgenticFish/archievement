// lib/config/plugin.js
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { homedir as realHomedir } from "node:os";
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
 * @typedef {{
 *   pluginConfigPath?: string,
 *   legacyRcPath?: string,
 *   homedir?: () => string,
 * }} ConfigOpts
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

// --- Migration ------------------------------------------------------------

/**
 * Read whatever YAML is at `path` (or {} if missing) and return it. Used by
 * migration to slurp legacy <root>/config/*.yml files.
 *
 * @param {string} path
 * @returns {Record<string, unknown>}
 */
function readYaml(path) {
  if (!existsSync(path)) return {};
  return yaml.load(readFileSync(path, "utf8")) ?? {};
}

const LEGACY_ROOT_CONFIG_FILES = ["global.yml", "projects.yml", "user-prefs.yml"];

/**
 * Apply all known legacy-source migrations onto `config`. Returns a `dirty`
 * flag plus an `unlink` list of files to clean up after a successful write.
 *
 * Migration sources, in order:
 *   1. ~/.archievementrc  → archievement_root pointer
 *   2. <root>/config/global.yml    → default_language, stale_days
 *   3. <root>/config/user-prefs.yml → languages_known
 *   4. <root>/config/projects.yml  → projects, ignore
 *
 * @param {PluginConfig} config Live config to mutate.
 * @param {ConfigOpts} opts
 * @returns {{ dirty: boolean, unlink: string[], rmdirIfEmpty: string | null }}
 */
function applyLegacyMigrations(config, opts) {
  const homedirFn = opts.homedir ?? realHomedir;
  const legacyRcPath = opts.legacyRcPath ?? join(homedirFn(), ".archievementrc");
  const unlink = [];
  let dirty = false;

  if (!config.archievement_root && existsSync(legacyRcPath)) {
    const value = readFileSync(legacyRcPath, "utf8").trim();
    if (value) {
      config.archievement_root = value;
      unlink.push(legacyRcPath);
      dirty = true;
    }
  }

  let rmdirIfEmpty = null;
  if (config.archievement_root) {
    const legacyConfigDir = join(config.archievement_root, "config");
    if (existsSync(legacyConfigDir)) {
      rmdirIfEmpty = legacyConfigDir;
      for (const name of LEGACY_ROOT_CONFIG_FILES) {
        const filePath = join(legacyConfigDir, name);
        if (!existsSync(filePath)) continue;
        const data = readYaml(filePath);
        if (name === "global.yml") {
          if (typeof data.default_language === "string") {
            config.default_language = data.default_language;
            dirty = true;
          }
          if (typeof data.stale_days === "number") {
            config.stale_days = data.stale_days;
            dirty = true;
          }
        } else if (name === "user-prefs.yml") {
          if (Array.isArray(data.languages_known)) {
            config.languages_known = data.languages_known;
            dirty = true;
          }
        } else if (name === "projects.yml") {
          if (Array.isArray(data.projects)) {
            config.projects = data.projects;
            dirty = true;
          }
          if (Array.isArray(data.ignore)) {
            config.ignore = data.ignore;
            dirty = true;
          }
        }
        unlink.push(filePath);
      }
    }
  }

  return { dirty, unlink, rmdirIfEmpty };
}

// --- loadConfig (the main read path) --------------------------------------

/**
 * Load the unified plugin config. Returns the full config with defaults
 * applied. Performs lazy migration of legacy sources (`~/.archievementrc`
 * and `<root>/config/*.yml`) the first time it sees them, then unlinks the
 * legacy files and writes a single merged config to plugin-data.
 *
 * @param {ConfigOpts} [opts]
 * @returns {PluginConfig}
 */
export function loadConfig(opts = {}) {
  const pluginConfigPath = opts.pluginConfigPath ?? getPluginConfigPath();
  const onDisk = existsSync(pluginConfigPath)
    ? (yaml.load(readFileSync(pluginConfigPath, "utf8")) ?? {})
    : {};

  /** @type {PluginConfig} */
  const merged = {
    archievement_root: onDisk.archievement_root ?? null,
    default_language: onDisk.default_language ?? DEFAULT_CONFIG.default_language,
    stale_days:
      typeof onDisk.stale_days === "number" ? onDisk.stale_days : DEFAULT_CONFIG.stale_days,
    languages_known: Array.isArray(onDisk.languages_known) ? onDisk.languages_known : [],
    projects: Array.isArray(onDisk.projects) ? onDisk.projects : [],
    ignore: Array.isArray(onDisk.ignore) ? onDisk.ignore : [],
  };

  const { dirty, unlink, rmdirIfEmpty } = applyLegacyMigrations(merged, opts);

  if (dirty) {
    saveConfig({ pluginConfigPath }, merged);
    for (const p of unlink) {
      try {
        unlinkSync(p);
      } catch {
        // ignore: file may have been removed concurrently
      }
    }
    if (rmdirIfEmpty) {
      try {
        if (readdirSync(rmdirIfEmpty).length === 0) {
          rmdirSync(rmdirIfEmpty);
        }
      } catch {
        // ignore: dir may be non-empty or already gone
      }
    }
  }

  return merged;
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
