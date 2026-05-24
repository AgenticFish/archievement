// lib/entries/list.js
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { readFrontmatter } from "../frontmatter.js";

/**
 * @typedef {import("./path.js").EntryPointer} EntryPointer
 * @typedef {import("./path.js").Layout} Layout
 * @typedef {import("./path.js").Category} Category
 * @typedef {import("./path.js").EntryType} EntryType
 *
 * @typedef {{
 *   category?: Category,
 *   type?: EntryType,
 *   status?: "todo" | "in-progress" | "done",
 *   project?: string,
 *   updatedSince?: string,
 *   updatedUntil?: string,
 * }} ListFilters
 *
 * @typedef {{ pointer: EntryPointer, layout: Layout, path: string, data: Record<string, unknown> }} EntrySummary
 */

const CATEGORIES = ["work", "personal"];
const TYPES = ["ticketed", "unticketed", "learning", "idea"];

/**
 * @param {string} root
 * @param {ListFilters} filters
 * @returns {EntrySummary[]}
 */
export function listEntries(root, filters = {}) {
  const out = [];
  for (const category of CATEGORIES) {
    if (filters.category && filters.category !== category) continue;
    for (const type of TYPES) {
      if (filters.type && filters.type !== type) continue;
      const typeDir = join(root, category, type);
      if (!existsSync(typeDir)) continue;
      for (const name of readdirSync(typeDir)) {
        const childPath = join(typeDir, name);
        const childStat = statSync(childPath);
        let layout, indexFile, id;
        if (childStat.isDirectory()) {
          indexFile = join(childPath, "index.md");
          if (!existsSync(indexFile)) continue;
          layout = "dir";
          id = name;
        } else if (childStat.isFile() && name.endsWith(".md")) {
          indexFile = childPath;
          layout = "file";
          id = name.slice(0, -3);
        } else {
          continue;
        }
        const { data } = readFrontmatter(indexFile);
        if (!matchesFilters(data, filters)) continue;
        out.push({
          pointer: { category, type, id },
          layout,
          path: indexFile,
          data,
        });
      }
    }
  }
  return out;
}

function matchesFilters(data, filters) {
  if (filters.status && data.status !== filters.status) return false;
  if (filters.project && data.project !== filters.project) return false;
  if (filters.updatedSince && (data.updated ?? "") < filters.updatedSince) return false;
  if (filters.updatedUntil && (data.updated ?? "") > filters.updatedUntil) return false;
  return true;
}
