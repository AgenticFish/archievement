// lib/promote/move.js
import { cpSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { readEntry } from "../entries/read.js";
import { writeFrontmatter, updateFrontmatter } from "../frontmatter.js";
import { entryFilePath, entryIndexPath, entryDirPath, locateEntry } from "../entries/path.js";

/**
 * @typedef {import("../entries/path.js").EntryPointer} EntryPointer
 * @typedef {import("../entries/path.js").Layout} Layout
 */

/**
 * Move an entry to a new (category, type, id). The source is preserved
 * (audit trail) with `status: done` and a `promoted_to` link. The target
 * gets a `promoted_from` link back to the source.
 *
 * The target's layout is given by `opts.layout`. If the source layout
 * differs and is "file" while target is "dir", caller should run
 * expandFileToDir first.
 *
 * @param {string} root
 * @param {EntryPointer} from
 * @param {EntryPointer} to
 * @param {{ now: string, layout: Layout, extras?: Record<string, unknown> }} opts
 */
export function moveEntry(root, from, to, opts) {
  const sourceLocated = locateEntry(root, from);
  if (!sourceLocated) {
    throw new Error(`Source entry not found: ${pointerKey(from)}`);
  }
  if (locateEntry(root, to) !== null) {
    throw new Error(`Target entry already exists: ${pointerKey(to)}`);
  }
  const source = readEntry(root, from);

  const targetExtras = opts.extras ?? {};
  const targetData = {
    ...source.data,
    category: to.category,
    type: to.type,
    layout: opts.layout,
    promoted_from: pointerKey(from),
    updated: opts.now,
    ...targetExtras,
  };
  delete targetData.promoted_to;

  // For type-specific fields we may need to drop ones that no longer fit.
  // (Generic; orchestrate.js can pre-clean if needed.)

  const targetPath = opts.layout === "file" ? entryFilePath(root, to) : entryIndexPath(root, to);

  if (sourceLocated.layout === "dir" && opts.layout === "dir") {
    // Copy entire source directory to target directory, then overwrite index.md.
    cpSync(entryDirPath(root, from), entryDirPath(root, to), { recursive: true });
    writeFrontmatter(targetPath, targetData, source.body);
  } else if (sourceLocated.layout === "file" && opts.layout === "file") {
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourceLocated.path, targetPath);
    writeFrontmatter(targetPath, targetData, source.body);
  } else if (sourceLocated.layout === "file" && opts.layout === "dir") {
    mkdirSync(entryDirPath(root, to), { recursive: true });
    writeFrontmatter(targetPath, targetData, source.body);
  } else {
    throw new Error(
      "Source is dir-layout but target requested file-layout; collapse not supported.",
    );
  }

  // Mark source as done + promoted_to
  updateFrontmatter(sourceLocated.path, {
    status: "done",
    promoted_to: pointerKey(to),
    updated: opts.now,
  });
}

function pointerKey(ptr) {
  return `${ptr.category}/${ptr.type}/${ptr.id}`;
}
