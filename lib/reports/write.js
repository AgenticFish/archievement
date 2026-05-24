// lib/reports/write.js
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeFrontmatter } from "../frontmatter.js";

/**
 * @typedef {"summary" | "completion" | "prediction" | "perf-review"} ReportKind
 *
 * @typedef {{
 *   kind: ReportKind,
 *   timestamp: string,
 *   category?: "work" | "personal",
 * }} ReportFilenameOpts
 *
 * @typedef {{
 *   kind: ReportKind,
 *   timestamp: string,
 *   category?: "work" | "personal",
 *   frontmatter: Record<string, unknown>,
 *   body: string,
 * }} WriteReportOpts
 */

/**
 * @param {ReportFilenameOpts} opts
 * @returns {string} relative filename under archievement/reports/
 */
export function makeReportFilename(opts) {
  if (opts.kind === "perf-review") {
    if (!opts.category) {
      throw new Error("perf-review report requires opts.category");
    }
    return `perf-review/${opts.timestamp}-${opts.category}.md`;
  }
  return `${opts.timestamp}-${opts.kind}.md`;
}

/**
 * @param {string} root archievement_root absolute path
 * @param {WriteReportOpts} opts
 * @returns {string} absolute path to the written file
 */
export function writeReport(root, opts) {
  const relName = makeReportFilename(opts);
  const absPath = join(root, "reports", relName);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFrontmatter(absPath, opts.frontmatter, opts.body);
  return absPath;
}
