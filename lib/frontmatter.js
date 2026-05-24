// lib/frontmatter.js
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import matter from "gray-matter";

/**
 * @typedef {{ data: Record<string, unknown>, body: string }} ParsedEntry
 */

/**
 * @param {string} path
 * @returns {ParsedEntry}
 */
export function readFrontmatter(path) {
  const raw = readFileSync(path, "utf8");
  const parsed = matter(raw);
  return { data: parsed.data ?? {}, body: parsed.content ?? "" };
}

/**
 * Write a markdown file with given frontmatter data and body.
 *
 * @param {string} path
 * @param {Record<string, unknown>} data
 * @param {string} body
 */
export function writeFrontmatter(path, data, body) {
  mkdirSync(dirname(path), { recursive: true });
  const serialized = matter.stringify(body, data);
  writeFileSync(path, serialized, "utf8");
}

/**
 * Merge new fields into the frontmatter without disturbing the body.
 *
 * @param {string} path
 * @param {Record<string, unknown>} patch
 */
export function updateFrontmatter(path, patch) {
  const { data, body } = readFrontmatter(path);
  writeFrontmatter(path, { ...data, ...patch }, body);
}

/**
 * Append text to the body of a markdown file, keeping frontmatter intact.
 *
 * @param {string} path
 * @param {string} text
 */
export function appendBody(path, text) {
  const { data, body } = readFrontmatter(path);
  writeFrontmatter(path, data, body + text);
}
