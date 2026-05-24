// lib/config/user-prefs.js
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import yaml from "js-yaml";

export const DEFAULT_USER_PREFS = Object.freeze({
  languages_known: [],
});

/**
 * @param {string} path
 * @returns {{ languages_known: string[] }}
 */
export function readUserPrefs(path) {
  if (!existsSync(path)) {
    return { ...DEFAULT_USER_PREFS, languages_known: [] };
  }
  const parsed = yaml.load(readFileSync(path, "utf8")) ?? {};
  return {
    languages_known: Array.isArray(parsed.languages_known) ? parsed.languages_known : [],
  };
}

/**
 * @param {string} path
 * @param {{ languages_known: string[] }} prefs
 */
export function writeUserPrefs(path, prefs) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, yaml.dump(prefs), "utf8");
}

/**
 * Append a language code to languages_known if not already present.
 * Pure: returns a new object.
 *
 * @param {{ languages_known: string[] }} prefs
 * @param {string} lang
 * @returns {{ languages_known: string[] }}
 */
export function rememberLanguage(prefs, lang) {
  if (prefs.languages_known.includes(lang)) {
    return prefs;
  }
  return { ...prefs, languages_known: [...prefs.languages_known, lang] };
}
