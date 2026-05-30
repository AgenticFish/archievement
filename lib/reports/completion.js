// lib/reports/completion.js

const CATEGORY_ORDER = ["work", "personal"];
const TYPE_ORDER = ["ticketed", "unticketed", "learning"];

/**
 * @typedef {import("../entries/list.js").EntrySummary} EntrySummary
 * @typedef {{ from: string, to: string }} DateRange
 */

/**
 * @param {EntrySummary[]} entries
 * @param {DateRange} range
 * @returns {string} markdown body
 */
export function buildCompletion(entries, range) {
  const inRange = entries.filter(
    (e) =>
      e.data.status === "done" &&
      (e.data.updated ?? "") >= range.from &&
      (e.data.updated ?? "") <= range.to,
  );
  const lines = [`# Completed (${range.from}..${range.to})\n`];
  for (const category of CATEGORY_ORDER) {
    const ofCategory = inRange.filter((e) => e.data.category === category);
    if (ofCategory.length === 0) continue;
    lines.push(`## ${capitalize(category)}\n`);

    for (const type of TYPE_ORDER) {
      const ofType = ofCategory.filter((e) => e.data.type === type);
      if (ofType.length === 0) continue;
      lines.push(`### ${headingFor(type)} (${ofType.length})`);
      for (const e of ofType) {
        const prCount = Array.isArray(e.data.prs) ? e.data.prs.length : 0;
        const prSuffix = prCount > 0 ? ` — ${prCount} PR${prCount > 1 ? "s" : ""}` : "";
        lines.push(`- **${e.pointer.id}** — done ${e.data.updated}${prSuffix}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

function headingFor(type) {
  if (type === "ticketed") return "Ticketed";
  if (type === "unticketed") return "Unticketed";
  if (type === "learning") return "Learning";
  return type;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
