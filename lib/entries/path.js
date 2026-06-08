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
 * Extract the stable entry-slug from an entry pointer — the cross-promote
 * identity. Every id is encoded `<project-slug>_<entry-slug>` (the project
 * segment is `tbd` when unclassified), so parsing is two-stage:
 *
 *   (1) strip the project segment: everything up to and including the first `_`.
 *   (2) for `ticketed` only, strip the leading `^[A-Z][A-Z0-9]*-\d+-` ticket
 *       prefix (e.g. `EGA-5971-voice-refactor` → `voice-refactor`). A ticket
 *       with no slug suffix (`EGA-5971`) has no prefix to strip and is returned
 *       as-is.
 *
 * Because the project segment is removed before comparison, promote may change
 * the project while preserving the entry-slug. Clean break: ids are assumed to
 * carry the `_` delimiter; there is no pre-convention fallback.
 *
 * @param {{ type: EntryType, id: string }} ptr
 * @returns {string}
 */
export function slugOf(ptr) {
  const entrySlug = ptr.id.slice(ptr.id.indexOf("_") + 1);
  if (ptr.type === "ticketed") {
    return entrySlug.replace(/^[A-Z][A-Z0-9]*-\d+-/, "");
  }
  return entrySlug;
}

/**
 * Extract the project segment from an entry id — everything before the first
 * `_`. Every id has a project segment by construction (`tbd` at minimum), so
 * this always returns a non-empty string. Used by find / reports to display or
 * group entries by project ownership.
 *
 * @param {{ id: string }} ptr
 * @returns {string}
 */
export function projectOf(ptr) {
  return ptr.id.slice(0, ptr.id.indexOf("_"));
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
