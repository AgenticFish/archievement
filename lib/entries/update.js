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
 * Append markdown to the entry's main body — the `.md` file for file-layout,
 * `<dir>/index.md` for dir-layout. Frontmatter is preserved either way.
 *
 * @param {string} root
 * @param {EntryPointer} ptr
 * @param {string} text  markdown to append (caller ensures leading newline)
 */
export function appendToBody(root, ptr, text) {
  const located = locateEntry(root, ptr);
  if (!located) {
    throw new Error(`Entry not found: ${ptr.category}/${ptr.type}/${ptr.id}`);
  }
  appendBody(located.path, text);
}

/**
 * Append markdown to a sibling doc inside a dir-layout entry's directory
 * (e.g. `progress.md`, `brainstorm.md`, `plan.md`). Creates the file on first
 * call; sibling docs are plain markdown with no frontmatter.
 *
 * Throws on file-layout entries — file-layout has no sibling slot. Callers that
 * want to add content to a file-layout entry should use `appendToBody`.
 *
 * @param {string} root
 * @param {EntryPointer} ptr
 * @param {string} docName  e.g. "progress", "brainstorm", "plan"
 * @param {string} text     markdown to append
 */
export function appendToSiblingDoc(root, ptr, docName, text) {
  if (typeof text !== "string") {
    throw new TypeError(
      `appendToSiblingDoc: text must be a string, got ${text === null ? "null" : typeof text}`,
    );
  }
  const located = locateEntry(root, ptr);
  if (!located) {
    throw new Error(`Entry not found: ${ptr.category}/${ptr.type}/${ptr.id}`);
  }
  if (located.layout !== "dir") {
    throw new Error(
      `Cannot append sibling doc on file-layout entry: ${ptr.category}/${ptr.type}/${ptr.id}`,
    );
  }
  const file = join(entryDirPath(root, ptr), `${docName}.md`);
  if (existsSync(file)) {
    writeFileSync(file, readFileSync(file, "utf8") + text, "utf8");
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
