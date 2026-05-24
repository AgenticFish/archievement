// lib/reports/perf-review.js
import { listEntries } from "../entries/list.js";
import { computeAnchors } from "./stats.js";

/**
 * Collect data for a perf review with hard category isolation.
 *
 * Phase 1: glob only the requested category directory (the other category's
 * files are never visited).
 * Phase 2: validate each entry's frontmatter `category` matches the request;
 * mismatched entries are dropped with a warning instead of being included.
 *
 * @param {string} root
 * @param {{ category: "work" | "personal", from: string, to: string }} opts
 * @returns {{
 *   category: "work" | "personal",
 *   from: string,
 *   to: string,
 *   entries: ReturnType<typeof listEntries>,
 *   anchors: ReturnType<typeof computeAnchors>,
 *   warnings: string[],
 * }}
 */
export function collectPerfReviewData(root, opts) {
  // Phase 1: list only requested category (listEntries respects category filter
  // and only visits that subtree).
  const candidates = listEntries(root, { category: opts.category });

  // Phase 2: belt-and-suspenders frontmatter validation.
  const warnings = [];
  const entries = [];
  for (const e of candidates) {
    if (e.data.category !== opts.category) {
      warnings.push(
        `Skipping ${e.pointer.category}/${e.pointer.type}/${e.pointer.id}: frontmatter category mismatch (expected ${opts.category}, got ${e.data.category}).`,
      );
      continue;
    }
    const updated = e.data.updated ?? "";
    if (updated < opts.from || updated > opts.to) continue;
    entries.push(e);
  }

  // Anchor numbers are computed from the FILTERED list (only matching category, in range).
  const anchors = computeAnchors(entries, { from: opts.from, to: opts.to });

  return {
    category: opts.category,
    from: opts.from,
    to: opts.to,
    entries,
    anchors,
    warnings,
  };
}
