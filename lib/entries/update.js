// lib/entries/update.js
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { appendBody, updateFrontmatter } from "../frontmatter.js";
import { entryDirPath, locateEntry } from "./path.js";

/**
 * @typedef {import("./path.js").EntryPointer} EntryPointer
 */

/**
 * @param {string} root
 * @param {EntryPointer} ptr
 * @param {Record<string, unknown>} patch
 */
export function updateEntryFrontmatter(root, ptr, patch) {
  const located = locateEntry(root, ptr);
  if (!located) {
    throw new Error(`Entry not found: ${ptr.category}/${ptr.type}/${ptr.id}`);
  }
  updateFrontmatter(located.path, patch);
}

/**
 * Append a markdown section to a named doc within an entry.
 *
 * For dir-layout: write/append to `<entry-dir>/<docName>.md`. If the doc file does
 * not yet exist, create it (no frontmatter — sibling docs are plain markdown).
 *
 * For file-layout: docName is ignored; the section is appended directly to the
 * single file's body.
 *
 * @param {string} root
 * @param {EntryPointer} ptr
 * @param {string} docName  e.g. "progress", "brainstorm", "plan"
 * @param {string} text     markdown to append (caller ensures leading newline)
 */
export function appendToDoc(root, ptr, docName, text) {
  const located = locateEntry(root, ptr);
  if (!located) {
    throw new Error(`Entry not found: ${ptr.category}/${ptr.type}/${ptr.id}`);
  }
  if (located.layout === "file") {
    appendBody(located.path, text);
    return;
  }
  const dir = entryDirPath(root, ptr);
  const file = join(dir, `${docName}.md`);
  if (existsSync(file)) {
    const current = readFileSync(file, "utf8");
    writeFileSync(file, current + text, "utf8");
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text, "utf8");
  }
}

/**
 * Create a sibling file inside a dir-layout entry (e.g., `pr-summaries/<date>-pr-<n>.md`).
 *
 * @param {string} root
 * @param {EntryPointer} ptr
 * @param {string} relPath path relative to the entry's directory
 * @param {string} content
 */
export function writeSiblingDoc(root, ptr, relPath, content) {
  const located = locateEntry(root, ptr);
  if (!located) {
    throw new Error(`Entry not found: ${ptr.category}/${ptr.type}/${ptr.id}`);
  }
  if (located.layout !== "dir") {
    throw new Error(
      `Cannot write sibling doc on file-layout entry: ${ptr.category}/${ptr.type}/${ptr.id}`,
    );
  }
  const target = join(entryDirPath(root, ptr), relPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}
