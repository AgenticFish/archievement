// lib/reports/prediction-status.js
import { listEntries } from "../entries/list.js";
import { slugOf } from "../entries/path.js";
import { readFrontmatter, writeFrontmatter } from "../frontmatter.js";

const START_ANCHOR = "<!-- archievement:status-table:start -->";
const END_ANCHOR = "<!-- archievement:status-table:end -->";

export class MissingAnchorsError extends Error {
  constructor(message) {
    super(message);
    this.name = "MissingAnchorsError";
  }
}

/**
 * @typedef {{ id: string, classification: string, status: string }} StatusRow
 * @typedef {{ id: string, classification: string }} ParsedRow
 */

/**
 * Render the anchored status-table block.
 *
 * @param {StatusRow[]} rows
 * @returns {string}
 */
export function renderStatusTable(rows) {
  const lines = [
    START_ANCHOR,
    "",
    "| Idea | Classification | Status |",
    "| --- | --- | --- |",
    ...rows.map((r) => `| ${r.id} | ${r.classification} | ${r.status} |`),
    "",
    END_ANCHOR,
  ];
  return lines.join("\n");
}

/**
 * Find the anchored block in a body and parse the table inside it.
 *
 * @param {string} body
 * @returns {{ block: string, rows: ParsedRow[] } | null}
 */
export function parseStatusTable(body) {
  const startIdx = body.indexOf(START_ANCHOR);
  if (startIdx === -1) return null;
  const endIdx = body.indexOf(END_ANCHOR, startIdx + START_ANCHOR.length);
  if (endIdx === -1) return null;
  const block = body.slice(startIdx, endIdx + END_ANCHOR.length);
  const between = body.slice(startIdx + START_ANCHOR.length, endIdx);
  const tableLines = between.split("\n").filter((l) => l.trim().startsWith("|"));
  if (tableLines.length < 2) {
    return { block, rows: [] };
  }
  const rows = [];
  for (let i = 2; i < tableLines.length; i++) {
    const cells = tableLines[i].split("|").map((c) => c.trim());
    if (cells.length < 4) continue;
    rows.push({ id: cells[1], classification: cells[2] });
  }
  return { block, rows };
}

/**
 * Resolve the status cell for an idea slug by locating the entry that currently
 * carries that slug. A live idea reports its own status; once graduated, the
 * unticketed/ticketed entry (same slug, recovered via slugOf) reports its real
 * current status; if the slug exists nowhere it was deliberately removed.
 *
 * @param {ReturnType<typeof listEntries>} entries
 * @param {string} slug
 * @returns {"todo" | "in-progress" | "done" | "removed" | string}
 */
export function resolveStatus(entries, slug) {
  const idea = entries.find((e) => e.pointer.type === "idea" && slugOf(e.pointer) === slug);
  if (idea) return String(idea.data.status ?? "todo");
  const graduated = entries.find((e) => e.pointer.type !== "idea" && slugOf(e.pointer) === slug);
  if (graduated) return String(graduated.data.status ?? "todo");
  return "removed";
}

/**
 * Replace the status column of the anchored table in `body` with fresh values.
 *
 * @param {string} body
 * @param {string} root
 * @returns {string}
 */
export function freshenStatusTable(body, root /* , _opts = {} */) {
  const parsed = parseStatusTable(body);
  if (!parsed) {
    throw new MissingAnchorsError(
      "status-table anchors not found; generate a new prediction report or add the anchors manually",
    );
  }
  const entries = listEntries(root, {});
  const refreshed = parsed.rows.map((r) => ({
    id: r.id,
    classification: r.classification,
    status: resolveStatus(entries, r.id),
  }));
  const newBlock = renderStatusTable(refreshed);
  return body.replace(parsed.block, newBlock);
}

/**
 * Refresh the status table of a prediction report file in place.
 *
 * @param {string} reportPath
 * @param {string} root
 * @returns {{ path: string, changed: boolean }}
 */
export function refreshReportFile(reportPath, root /* , _opts = {} */) {
  const { data, body } = readFrontmatter(reportPath);
  const newBody = freshenStatusTable(body, root);
  if (newBody === body) {
    return { path: reportPath, changed: false };
  }
  writeFrontmatter(reportPath, data, newBody);
  return { path: reportPath, changed: true };
}
