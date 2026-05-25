// lib/reports/write.js
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeFrontmatter } from "../frontmatter.js";

/**
 * @typedef {"summary" | "completion" | "prediction" | "perf-review"} ReportKind
 *
 * @typedef {{
 *   kind: ReportKind,
 *   timestamp?: string,
 *   category?: "work" | "personal",
 * }} ReportFilenameOpts
 *
 * @typedef {{
 *   kind: ReportKind,
 *   timestamp?: string,
 *   category?: "work" | "personal",
 *   frontmatter: Record<string, unknown>,
 *   body: string,
 * }} WriteReportOpts
 */

/**
 * Format a Date in local time as `YYYY-MM-DDTHH-MM`.
 *
 * @param {Date} [d]
 * @returns {string}
 */
export function localTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

/**
 * @param {ReportFilenameOpts} opts
 * @returns {string} relative filename under archievement/reports/
 */
export function makeReportFilename(opts) {
  const timestamp = opts.timestamp ?? localTimestamp();
  if (opts.kind === "perf-review") {
    if (!opts.category) {
      throw new Error("perf-review report requires opts.category");
    }
    return `perf-review/${timestamp}-${opts.category}.md`;
  }
  return `${timestamp}-${opts.kind}.md`;
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
