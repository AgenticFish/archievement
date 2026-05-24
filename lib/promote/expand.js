// lib/promote/expand.js
import { unlinkSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { readEntry } from "../entries/read.js";
import { writeFrontmatter } from "../frontmatter.js";
import { entryFilePath, entryIndexPath, locateEntry } from "../entries/path.js";

/**
 * @typedef {import("../entries/path.js").EntryPointer} EntryPointer
 */

/**
 * Convert a file-layout entry to dir-layout. No-op if already dir-layout.
 *
 * @param {string} root
 * @param {EntryPointer} ptr
 */
export function expandFileToDir(root, ptr) {
  const located = locateEntry(root, ptr);
  if (!located) {
    throw new Error(`Entry not found: ${ptr.category}/${ptr.type}/${ptr.id}`);
  }
  if (located.layout === "dir") return;
  const view = readEntry(root, ptr);
  if (!view) throw new Error(`Entry not found: ${ptr.category}/${ptr.type}/${ptr.id}`);
  const oldPath = entryFilePath(root, ptr);
  const indexPath = entryIndexPath(root, ptr);
  mkdirSync(dirname(indexPath), { recursive: true });
  writeFrontmatter(indexPath, { ...view.data, layout: "dir" }, view.body);
  unlinkSync(oldPath);
}
