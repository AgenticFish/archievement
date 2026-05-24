// lib/entries/path.js
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * @typedef {"work" | "personal"} Category
 * @typedef {"ticketed" | "unticketed" | "learning" | "idea"} EntryType
 * @typedef {{ category: Category, type: EntryType, id: string }} EntryPointer
 * @typedef {"file" | "dir"} Layout
 * @typedef {{ layout: Layout, path: string }} LocatedEntry
 */

/**
 * Returns the file-layout path for an entry (without checking existence).
 *
 * @param {string} root archievement_root absolute path
 * @param {EntryPointer} ptr
 * @returns {string}
 */
export function entryFilePath(root, ptr) {
  return join(root, ptr.category, ptr.type, `${ptr.id}.md`);
}

/**
 * Returns the dir-layout directory path for an entry (without checking existence).
 *
 * @param {string} root
 * @param {EntryPointer} ptr
 * @returns {string}
 */
export function entryDirPath(root, ptr) {
  return join(root, ptr.category, ptr.type, ptr.id);
}

/**
 * Returns the dir-layout index.md path.
 *
 * @param {string} root
 * @param {EntryPointer} ptr
 * @returns {string}
 */
export function entryIndexPath(root, ptr) {
  return join(entryDirPath(root, ptr), "index.md");
}

/**
 * Some types are best modeled as directories because they normally
 * accumulate sub-files (materials/, etc.). This is just a hint for create.js.
 *
 * @param {EntryType} type
 */
export function isDirOnlyType(type) {
  return type === "learning";
}

/**
 * Locate an existing entry on disk. Returns null if neither file nor dir form exists.
 *
 * @param {string} root
 * @param {EntryPointer} ptr
 * @returns {LocatedEntry | null}
 */
export function locateEntry(root, ptr) {
  const filePath = entryFilePath(root, ptr);
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    return { layout: "file", path: filePath };
  }
  const indexPath = entryIndexPath(root, ptr);
  if (existsSync(indexPath) && statSync(indexPath).isFile()) {
    return { layout: "dir", path: indexPath };
  }
  return null;
}
