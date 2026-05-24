// lib/reports/summary.js

const CATEGORY_ORDER = ["work", "personal"];
const TYPE_ORDER = ["ticketed", "unticketed", "learning", "idea"];
const TYPE_HEADING = {
  ticketed: "Ticketed",
  unticketed: "Unticketed",
  learning: "Learning",
  idea: "Ideas",
};

/**
 * @typedef {import("../entries/list.js").EntrySummary} EntrySummary
 * @typedef {{ now: string, staleDays: number }} SummaryOpts
 */

/**
 * @param {EntrySummary[]} entries
 * @param {SummaryOpts} opts
 * @returns {string} markdown body
 */
export function buildSummary(entries, opts) {
  const live = entries.filter((e) => e.data.status !== "done");
  const lines = [`# Summary (${opts.now})\n`];
  for (const category of CATEGORY_ORDER) {
    const ofCategory = live.filter((e) => e.data.category === category);
    if (ofCategory.length === 0) continue;
    lines.push(`## ${capitalize(category)}\n`);
    for (const type of TYPE_ORDER) {
      const ofType = ofCategory.filter((e) => e.data.type === type);
      if (ofType.length === 0) continue;
      lines.push(`### ${TYPE_HEADING[type]} (${ofType.length})`);
      ofType.sort((a, b) => (b.data.updated ?? "").localeCompare(a.data.updated ?? ""));
      for (const e of ofType) {
        const age = ageInDays(e.data.updated, opts.now);
        const stale = age !== null && age > opts.staleDays ? " ⚠️ stale" : "";
        const ageStr = age === null ? "unknown" : age === 0 ? "today" : `${age}d ago`;
        lines.push(`- **${e.pointer.id}** — ${ageStr}${stale}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

function ageInDays(updated, now) {
  if (!updated) return null;
  const a = Date.parse(updated);
  const b = Date.parse(now);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
