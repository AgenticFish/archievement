---
name: report
description: Generate an archievement report — summary (in-progress snapshot), completion (done in time range), prediction (idea-advancement suggestions), or perf-review (with hard category isolation).
---

# archievement:report

## When to use

Invoke when the user wants to see progress, write a monthly self-tracking report, or generate a perf review draft.

## Flow

1. **Resolve archievement root.** Pass the plugin-data path explicitly — Claude Code substitutes `${CLAUDE_PLUGIN_DATA}` here, but does NOT inject it as an env var into the Bash subprocess:

   ```
   node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ resolveArchievementRoot }) => process.stdout.write(resolveArchievementRoot({ pluginConfigPath: '${CLAUDE_PLUGIN_DATA}/config.yml' }) ?? ''))"
   ```

   If the output is empty, STOP. Tell the user: "archievement is not set up. Run `/archievement:setup` first, then re-invoke this skill." Do NOT proceed, do NOT search the filesystem, do NOT use a default path.

   Then read `config/global.yml` for `default_language` and `stale_days`. Read `config/user-prefs.yml` for `languages_known`.

2. **Ask kind.** AskUserQuestion: "Which report?" options `summary (snapshot) / completion (done in range) / prediction (idea advancement) / perf-review`.

3. **For `summary`:**
   a. AskUserQuestion category filter (optional): `both / work only / personal only`. Default `both`.
   b. Call `listEntries(root, { category? })` from `lib/entries/list.js`.
   c. Call `buildSummary(entries, { now: today, staleDays: global.stale_days })` from `lib/reports/summary.js`.
   d. Determine output language (per session/global preference).
   e. Write the report via `writeReport(root, { kind: "summary", frontmatter, body })`. Omit `timestamp` — `writeReport` defaults it to the current local time (see Invariants).

4. **For `completion`:**
   a. AskUserQuestion range: `last 7 days / last 30 days / last 90 days / specify range`.
   b. AskUserQuestion category filter (optional, default both).
   c. `listEntries` + `buildCompletion(entries, { from, to })`.
   d. Write report.

5. **For `prediction`:**
   a. AskUserQuestion lookback: `last 60 days (default) / specify`.
   b. `collectPredictionData(root, { now, lookbackDays })` from `lib/reports/prediction.js`.
   c. **Synthesize the narrative yourself** using the LLM (this is not Node code). Layout: list each idea, propose connections to recent active/done entries by reading their summaries, suggest a promotion target (type/category/slug). Skip ideas with no clear connection (put them under "No clear path yet").
   d. Write report.

6. **For `perf-review`:**
   a. AskUserQuestion category: `work / personal`. **No `both` option** (single-audience).
   b. AskUserQuestion range: `last month / last half (180 days) / last year / specify`.
   c. AskUserQuestion: "Did you paste a perf review template / company criteria into this session?" `Yes — use it / No — generate free-form draft`.
   d. `collectPerfReviewData(root, { category, from, to })` from `lib/reports/perf-review.js`. **The other category is physically unread** — never load it.
   e. If `data.warnings.length > 0`, surface them to the user before proceeding.
   f. **Synthesize the narrative yourself** using the LLM. Use the template the user pasted if provided; otherwise use the free-form structure from spec §5.5. Pull the deterministic `anchors` from `data.anchors` — never re-compute or estimate; copy them verbatim.
   g. Always append the disclaimer from spec §5.5 verbatim.
   h. Write report under `reports/perf-review/<timestamp>-<category>.md`.

7. **Tell the user the report's path.**

## Invariants

- **`perf-review` never has access to the other category's data.** The data-collection function physically skips the other directory; do not try to widen the scope.
- **Anchors are sacred.** Numbers in perf-review reports come from `data.anchors`, not from estimation. If the user asks "what about my PR count for X", point them at the report's Anchors section, not your own count.
- **`prediction` is allowed to cross categories** (per spec §5.4) but the report's output is never auto-fed into a perf-review.
- **Never inline a UTC-derived timestamp into `writeReport`.** Always omit `opts.timestamp` (or pass `localTimestamp()` from `lib/reports/write.js`) — passing `new Date().toISOString().slice(0, 16).replace(":", "-")` produces UTC and crosses the date boundary on US evenings.
