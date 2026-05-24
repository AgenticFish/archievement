// lib/entries/create.js
import { writeFrontmatter } from "../frontmatter.js";
import { entryFilePath, entryIndexPath, locateEntry } from "./path.js";

/**
 * @typedef {import("./path.js").EntryPointer} EntryPointer
 * @typedef {import("./path.js").Layout} Layout
 *
 * @typedef {{
 *   pointer: EntryPointer,
 *   layout: Layout,
 *   extras: Record<string, unknown>,
 *   body: string,
 *   now: string,           // ISO date string yyyy-mm-dd
 * }} CreateEntryRequest
 *
 * @typedef {{ pointer: EntryPointer, layout: Layout, path: string }} CreateEntryResult
 */

/**
 * Create a brand-new entry. Refuses to overwrite an existing entry on disk.
 *
 * @param {string} root archievement_root absolute path
 * @param {CreateEntryRequest} req
 * @returns {CreateEntryResult}
 */
export function createEntry(root, req) {
  if (locateEntry(root, req.pointer) !== null) {
    throw new Error(
      `Entry already exists: ${req.pointer.category}/${req.pointer.type}/${req.pointer.id}`,
    );
  }
  const data = {
    category: req.pointer.category,
    type: req.pointer.type,
    status: "todo",
    created: req.now,
    updated: req.now,
    layout: req.layout,
    ...req.extras,
  };
  const targetPath =
    req.layout === "file" ? entryFilePath(root, req.pointer) : entryIndexPath(root, req.pointer);
  writeFrontmatter(targetPath, data, req.body);
  return { pointer: req.pointer, layout: req.layout, path: targetPath };
}
