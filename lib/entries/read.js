// lib/entries/read.js
import { readFrontmatter } from "../frontmatter.js";
import { locateEntry } from "./path.js";

/**
 * @typedef {import("./path.js").EntryPointer} EntryPointer
 * @typedef {import("./path.js").Layout} Layout
 * @typedef {{
 *   pointer: EntryPointer,
 *   layout: Layout,
 *   path: string,
 *   data: Record<string, unknown>,
 *   body: string,
 * }} EntryView
 */

/**
 * @param {string} root
 * @param {EntryPointer} ptr
 * @returns {EntryView | null}
 */
export function readEntry(root, ptr) {
  const located = locateEntry(root, ptr);
  if (!located) return null;
  const { data, body } = readFrontmatter(located.path);
  return { pointer: ptr, layout: located.layout, path: located.path, data, body };
}
