// lib/config/projects.js
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import yaml from "js-yaml";

const EMPTY = Object.freeze({ projects: [], ignore: [] });

/**
 * @typedef {{ type: "git-remote", url: string } | { type: "path", path: string }} Matcher
 * @typedef {{ match: Matcher, slug: string, category: "work" | "personal", language?: string }} ProjectEntry
 * @typedef {{ match: Matcher }} IgnoreEntry
 * @typedef {{ projects: ProjectEntry[], ignore: IgnoreEntry[] }} ProjectsConfig
 * @typedef {{ remote: string | null, cwd: string }} Probe
 * @typedef {{ kind: "match", project: ProjectEntry } | { kind: "ignored" } | { kind: "unknown" }} MatchResult
 */

/**
 * @param {string} path
 * @returns {ProjectsConfig}
 */
export function readProjectsConfig(path) {
  if (!existsSync(path)) {
    return { projects: [], ignore: [] };
  }
  const parsed = yaml.load(readFileSync(path, "utf8")) ?? {};
  return {
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    ignore: Array.isArray(parsed.ignore) ? parsed.ignore : [],
  };
}

/**
 * @param {string} path
 * @param {ProjectsConfig} config
 */
export function writeProjectsConfig(path, config) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, yaml.dump(config), "utf8");
}

/**
 * @param {ProjectsConfig} config
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

/**
 * @param {Matcher} matcher
 * @param {Probe} probe
 */
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
 * @param {ProjectsConfig} config
 * @param {ProjectEntry} entry
 * @returns {ProjectsConfig}
 */
export function addProject(config, entry) {
  return { ...config, projects: [...config.projects, entry] };
}

/**
 * @param {ProjectsConfig} config
 * @param {IgnoreEntry} entry
 * @returns {ProjectsConfig}
 */
export function addIgnore(config, entry) {
  return { ...config, ignore: [...config.ignore, entry] };
}
