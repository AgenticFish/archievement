// lib/promote/orchestrate.js
import { moveEntry } from "./move.js";
import { locateEntry, slugOf } from "../entries/path.js";

/**
 * @typedef {import("../entries/path.js").EntryPointer} EntryPointer
 * @typedef {import("../entries/path.js").Layout} Layout
 */

/**
 * Promote (graduate) an entry: move content to a new (category, type, id) —
 * the source is deleted, the slug is preserved. If the target requires a
 * different layout than the source, the move handles the layout conversion.
 *
 * @param {string} root
 * @param {EntryPointer} from
 * @param {EntryPointer} to
 * @param {{ now: string, targetLayout: Layout, extras?: Record<string, unknown> }} opts
 * @returns {{ source: { pointer: EntryPointer }, target: { pointer: EntryPointer, path: string } }}
 */
export function promote(root, from, to, opts) {
  const sourceLocated = locateEntry(root, from);
  if (!sourceLocated) {
    throw new Error(`Source entry not found: ${from.category}/${from.type}/${from.id}`);
  }
  if (slugOf(from) !== slugOf(to)) {
    throw new Error(
      `promote must preserve the slug: '${slugOf(from)}' (source) != '${slugOf(to)}' (target)`,
    );
  }
  moveEntry(root, from, to, {
    now: opts.now,
    layout: opts.targetLayout,
    extras: opts.extras,
  });
  const targetLocated = locateEntry(root, to);
  return {
    source: { pointer: from },
    target: { pointer: to, path: targetLocated.path },
  };
}
