// lib/reports/stats.js

/**
 * @typedef {import("../entries/list.js").EntrySummary} EntrySummary
 *
 * @typedef {{
 *   ticketsClosed: number,
 *   prsMerged: number,
 *   avgDaysToDone: number | null,
 * }} Anchors
 *
 * @typedef {{ from: string, to: string }} DateRange
 */

/**
 * @param {EntrySummary[]} entries
 * @param {DateRange} range
 * @returns {Anchors}
 */
export function computeAnchors(entries, range) {
  const inRangeDone = entries.filter(
    (e) =>
      e.data.status === "done" &&
      e.data.type === "ticketed" &&
      (e.data.updated ?? "") >= range.from &&
      (e.data.updated ?? "") <= range.to,
  );
  const ticketsClosed = inRangeDone.length;
  const prsMerged = inRangeDone.reduce(
    (sum, e) => sum + (Array.isArray(e.data.prs) ? e.data.prs.length : 0),
    0,
  );
  const days = inRangeDone
    .map((e) => daysBetween(e.data.created, e.data.updated))
    .filter((d) => d !== null);
  const avgDaysToDone =
    days.length === 0 ? null : roundTo(days.reduce((a, b) => a + b, 0) / days.length, 2);
  return { ticketsClosed, prsMerged, avgDaysToDone };
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  const start = Date.parse(a);
  const end = Date.parse(b);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return (end - start) / (1000 * 60 * 60 * 24);
}

function roundTo(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
