---
name: report
description: Generate an archievement report — summary (in-progress snapshot), completion (done in time range), prediction (idea-advancement suggestions), or perf-review (with hard category isolation).
---

# archievement:report

## When to use

Invoke when the user wants to see progress, write a monthly self-tracking report, or generate a perf review draft.

## Flow

1. **Load the unified plugin config.** Pass the plugin-data path explicitly — Claude Code substitutes `${CLAUDE_PLUGIN_DATA}` here, but does NOT inject it as an env var into the Bash subprocess:

   ```
   node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ loadConfig }) => process.stdout.write(JSON.stringify(loadConfig({ pluginConfigPath: '${CLAUDE_PLUGIN_DATA}/config.yml' }))))"
   ```

   Parse the JSON. If `archievement_root` is null, STOP. Tell the user: "archievement is not set up. Run `/archievement:setup` first, then re-invoke this skill." Do NOT proceed, do NOT search the filesystem, do NOT use a default path.

   Otherwise extract `archievement_root`, `default_language`, `stale_days`, `languages_known`, and `projects` from the parsed config for the steps below.

2. **Ask kind.** AskUserQuestion: "Which report?" options `summary (snapshot) / completion (done in range) / prediction (idea advancement) / perf-review / refresh-prediction-status (re-resolve table of an existing prediction)`.

3. **For `summary`:**
   a. AskUserQuestion category filter (optional): `both / work only / personal only`. Default `both`.
   b. AskUserQuestion project filter (optional). Build options dynamically from `config.projects`: `all projects` + one option per registered slug + `unregistered (no project field)`. Default `all projects`. If `config.projects` is empty, skip this question and use `all projects`.
   c. Call `listEntries(root, { category?, project? })` from `lib/entries/list.js`. Wiring:
      - `all projects` → omit the `project` filter.
      - `<slug>` → pass `project: "<slug>"`.
      - `unregistered (no project field)` → omit the `project` filter and post-filter the results in the node script: `entries.filter((e) => !e.data.project)`. `listEntries` does not have a sentinel for "no project field" by design — keep this filter in the skill.
   d. Call `buildSummary(entries, { now: today, staleDays: global.stale_days })` from `lib/reports/summary.js`.
   e. Determine output language (per session/global preference).
   f. Write the report via `writeReport(root, { kind: "summary", frontmatter, body })`. Omit `timestamp` — `writeReport` defaults it to the current local time (see Invariants). Record the chosen project filter in the frontmatter as `project_filter: "<slug>" | "unregistered" | null` (null when `all projects`).

4. **For `completion`:**
   a. AskUserQuestion range: `last 7 days / last 30 days / last 90 days / specify range`.
   b. AskUserQuestion category filter (optional, default both).
   c. AskUserQuestion project filter (optional) — same dynamic options and wiring as step 3b/3c (`all projects` / each registered slug / `unregistered`, default `all projects`, skip if `config.projects` is empty). For `unregistered`, post-filter the `listEntries` result with `entries.filter((e) => !e.data.project)`.
   d. `listEntries(root, { category?, project?, ... })` + `buildCompletion(entries, { from, to })`.
   e. Write report. Record the chosen project filter in the frontmatter as `project_filter: "<slug>" | "unregistered" | null`.

5. **For `prediction`:**
   a. AskUserQuestion lookback: `last 60 days (default) / specify`.
   b. `collectPredictionData(root, { now, lookbackDays })` from `lib/reports/prediction.js`.
   c. **Synthesize the narrative yourself** using the LLM (this is not Node code). Layout: list each idea, propose connections to recent active/done entries by reading their summaries, suggest a promotion target (type/category/slug). Skip ideas with no clear connection (put them under "No clear path yet").
   d. **Embed an anchored status table.** Immediately below the intro/lookback line and *before* "Promotion suggestions", include a `## Status` section with this exact structure (anchors are required):

      ```
      <!-- archievement:status-table:start -->

      | Idea | Classification | Status |
      | --- | --- | --- |
      | <slug> | <your short label, e.g. "small unticketed"> | (pending) |
      ...
      <!-- archievement:status-table:end -->
      ```

      One row per idea in `data.ideas`, preserving that order. The `Classification` cell is your own per-idea label (match the wording you use in the narrative below — "small unticketed", "medium unticketed", "needs brainstorm", etc.). The `Status` cell MUST be the literal `(pending)` placeholder — step 5e resolves it.

   e. **Freshen the table** before writing. Write the drafted body to a temp file and run a small driver that calls `freshenStatusTable(body, root)` from `lib/reports/prediction-status.js`, then use the returned string as the body for `writeReport`. Example one-liner (substitute concrete paths):

      ```
      node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/reports/prediction-status.js').then(async ({ freshenStatusTable }) => { const { readFileSync, writeFileSync } = await import('node:fs'); const body = readFileSync('/tmp/pred-body.md', 'utf8'); writeFileSync('/tmp/pred-body.md', freshenStatusTable(body, '<archievement_root>')); })"
      ```

      If this throws `MissingAnchorsError`, you forgot the anchors in 5d — regenerate the body and try again.

   f. Write the report via `writeReport(root, { kind: "prediction", frontmatter, body })` using the freshened body.

6. **For `perf-review`:**
   a. AskUserQuestion category: `work / personal`. **No `both` option** (single-audience).
   b. AskUserQuestion range: `last month / last half (180 days) / last year / specify`.
   c. AskUserQuestion: "Did you paste a perf review template / company criteria into this session?" `Yes — use it / No — generate free-form draft`.
   d. `collectPerfReviewData(root, { category, from, to })` from `lib/reports/perf-review.js`. **The other category is physically unread** — never load it.
   e. If `data.warnings.length > 0`, surface them to the user before proceeding.
   f. **Synthesize the narrative yourself** using the LLM. Use the template the user pasted if provided; otherwise use the free-form structure from spec §5.5. Pull the deterministic `anchors` from `data.anchors` — never re-compute or estimate; copy them verbatim.
   g. Always append the disclaimer from spec §5.5 verbatim.
   h. Write report under `reports/perf-review/<timestamp>-<category>.md`.

7. **For `refresh-prediction-status`:**
   a. List candidate reports — `<archievement_root>/reports/*-prediction.md` (exclude the `perf-review/` subdir). AskUserQuestion: "Which prediction report to refresh?" Build options from the file basenames, ordered most-recent-first by mtime; default = most recent. If no candidates exist, tell the user and stop.
   b. Call `refreshReportFile(<reportPath>, root)` from `lib/reports/prediction-status.js`. If it throws `MissingAnchorsError`, surface a clear message: "This report predates the status-table feature. Regenerate via `prediction` to embed a table." Do not modify the file.
   c. Read the updated report and print the contents of the anchored block (between `<!-- archievement:status-table:start -->` and `<!-- archievement:status-table:end -->`) so the user can see the resolved table. Mention whether `changed` was `true` or `false`.

8. **Tell the user the report's path.**

## Invariants

- **`perf-review` never has access to the other category's data.** The data-collection function physically skips the other directory; do not try to widen the scope.
- **Anchors are sacred.** Numbers in perf-review reports come from `data.anchors`, not from estimation. If the user asks "what about my PR count for X", point them at the report's Anchors section, not your own count.
- **`prediction` is allowed to cross categories** (per spec §5.4) but the report's output is never auto-fed into a perf-review.
- **Never inline a UTC-derived timestamp into `writeReport`.** Always omit `opts.timestamp` (or pass `localTimestamp()` from `lib/reports/write.js`) — passing `new Date().toISOString().slice(0, 16).replace(":", "-")` produces UTC and crosses the date boundary on US evenings.
