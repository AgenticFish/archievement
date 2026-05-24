// lib/reports/prediction.js
import { listEntries } from "../entries/list.js";

/**
 * Collect data for the LLM-driven prediction report. No category isolation.
 *
 * @param {string} root
 * @param {{ now: string, lookbackDays: number }} opts
 * @returns {{ ideas: ReturnType<typeof listEntries>, activeAndRecentDone: ReturnType<typeof listEntries> }}
 */
export function collectPredictionData(root, opts) {
  const lookbackDate = subtractDays(opts.now, opts.lookbackDays);
  const ideas = listEntries(root, { type: "idea" });
  const all = listEntries(root, {});
  const activeAndRecentDone = all.filter((e) => {
    if (e.data.type === "idea") return false;
    if (e.data.status === "in-progress") return true;
    if (e.data.status === "done" && (e.data.updated ?? "") >= lookbackDate) return true;
    return false;
  });
  return { ideas, activeAndRecentDone };
}

function subtractDays(date, days) {
  const t = Date.parse(date);
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(t - ms).toISOString().slice(0, 10);
}
