// lib/promote/move.js
import { cpSync, copyFileSync, mkdirSync, unlinkSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { readEntry } from "../entries/read.js";
import { writeFrontmatter } from "../frontmatter.js";
import { entryFilePath, entryIndexPath, entryDirPath, locateEntry } from "../entries/path.js";

/**
 * @typedef {import("../entries/path.js").EntryPointer} EntryPointer
 * @typedef {import("../entries/path.js").Layout} Layout
 */

/**
 * Graduate an entry to a new (category, type, id): copy its content (and, for
 * dir-layout sources, all sibling attachments) to the target, then DELETE the
 * source. No audit links are written — the slug, preserved across the move,
 * is the identity (see orchestrate.js for the slug-preservation invariant).
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
  // Source frontmatter carries over; the caller (orchestrate) overrides volatile fields (category/type/layout/updated) and supplies type-specific ones via extras.
  const targetData = {
    ...source.data,
    category: to.category,
    type: to.type,
    layout: opts.layout,
    updated: opts.now,
    ...targetExtras,
  };
  // Audit links are retired; never carry them onto the target.
  delete targetData.promoted_to;
  delete targetData.promoted_from;

  const targetPath = opts.layout === "file" ? entryFilePath(root, to) : entryIndexPath(root, to);

  if (sourceLocated.layout === "dir" && opts.layout === "dir") {
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

  // Graduate: delete the source now that its content lives at the target.
  if (sourceLocated.layout === "dir") {
    rmSync(entryDirPath(root, from), { recursive: true });
  } else {
    unlinkSync(sourceLocated.path);
  }
}

function pointerKey(ptr) {
  return `${ptr.category}/${ptr.type}/${ptr.id}`;
}
