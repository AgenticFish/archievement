// lib/config/global.js
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import yaml from "js-yaml";

export const DEFAULT_GLOBAL_CONFIG = Object.freeze({
  default_language: "en",
  stale_days: 21,
  archievement_root: "~/archievement",
});

/**
 * Read the global config YAML file. Returns defaults merged with any present
 * file contents. Missing file => defaults.
 *
 * @param {string} path Absolute path to global.yml
 * @returns {{ default_language: string, stale_days: number, archievement_root: string }}
 */
export function readGlobalConfig(path) {
  if (!existsSync(path)) {
    return { ...DEFAULT_GLOBAL_CONFIG };
  }
  const parsed = yaml.load(readFileSync(path, "utf8")) ?? {};
  return { ...DEFAULT_GLOBAL_CONFIG, ...parsed };
}

/**
 * Write the global config YAML file. Creates the parent directory if needed.
 *
 * @param {string} path
 * @param {{ default_language: string, stale_days: number, archievement_root: string }} config
 */
export function writeGlobalConfig(path, config) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, yaml.dump(config), "utf8");
}
