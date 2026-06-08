---
name: promote
description: Promote (graduate) an archievement entry — idea → ticketed/unticketed, or unticketed → ticketed, possibly across categories. Preserves the entry-slug, deletes the source, handles file → dir expansion.
---

# archievement:promote

## When to use

Invoke when an existing entry needs to graduate to a new form:
- `idea` → `ticketed` or `unticketed` (and possibly cross-category)
- `unticketed` → `ticketed` (e.g., the company opened a JIRA for what was research)
- file-layout → dir-layout expansion (without category/type change)

## Flow

1. **Resolve archievement root.** Pass the plugin-data path explicitly — Claude Code substitutes `${CLAUDE_PLUGIN_DATA}` here, but does NOT inject it as an env var into the Bash subprocess:

   ```
   node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ resolveArchievementRoot }) => process.stdout.write(resolveArchievementRoot({ pluginConfigPath: '${CLAUDE_PLUGIN_DATA}/config.yml' }) ?? ''))"
   ```

   If the output is empty, STOP. Tell the user: "archievement is not set up. Run `/archievement:setup` first, then re-invoke this skill." Do NOT proceed, do NOT search the filesystem, do NOT use a default path.

2. **Identify the source entry.** AskUserQuestion: "Which entry are you promoting?" Show active entries from the session context block; offer `Search by id/slug` as an escape hatch.

3. **Ask the target.** AskUserQuestion sequentially:
   - Target type: `ticketed / unticketed / learning / idea` (default to a sensible next step based on source type).
   - Target category: `work / personal` (default to source category).
   - Target id: **the entry-slug is preserved; the project segment may be filled in or changed.** Build the id with `makeId(project, entrySlug)` from `lib/entries/path.js`. The `entrySlug` must match the source's `slugOf` (promote rejects a different entry-slug). For `ticketed`, the entry-slug is `<TICKET>-<source-slug>` (e.g. source slug `voice-refactor` + ticket `EGA-5971` → entry-slug `EGA-5971-voice-refactor`, full id `egs-mobile_EGA-5971-voice-refactor`). For other types the entry-slug **equals the source slug**. The project segment comes from the target project (e.g. the SessionStart slug) or `tbd`; graduating a `tbd_` idea into a real project is the normal way an idea acquires its project.
   - Target layout: `dir / file` — required if source is file-layout and the user wants dir.

4. **Show a plan.** Print: "Promoting (graduating) `<source>` → `<target>`. The source will be **deleted**; its content (and any dir-layout attachments) moves to the target, which keeps the same slug." AskUserQuestion `Proceed / Cancel`.

5. **Execute.** Call `promote()` from `lib/promote/orchestrate.js`. Pass `now = today (YYYY-MM-DD)`, `targetLayout`, and any type-specific `extras` (e.g., `ticket_id`, `project`).

6. **Report.** Tell the user the new entry's path and that the source was graduated (deleted) — its content now lives at the target.

## Invariants

- Never overwrite an existing target — orchestrate.js refuses; surface the error and ask for a different id.
- **promote preserves the entry-slug, not the project.** `slugOf(target) === slugOf(source)` (the project segment is stripped before comparison, so the project may change). Ticketed targets carry `<TICKET>-<slug>` in the entry-slug segment. orchestrate.js enforces this.
- **promote graduates the source: it is deleted, not preserved.** Content (and dir attachments) is copied to the target first, so nothing is lost. No `promoted_from`/`promoted_to` links are written.
- `extras` must include `ticket_id` when target type is `ticketed`; ask if missing.
