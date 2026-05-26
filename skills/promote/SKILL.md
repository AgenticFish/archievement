---
name: promote
description: Promote an archievement entry — idea → ticketed/unticketed, or unticketed → ticketed, possibly across categories. Handles file → dir expansion and writes reciprocal audit-trail links.
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
   - Target id or slug. For `ticketed`, ask for the ticket ID. For others, propose a kebab-case slug derived from the source title; let the user edit.
   - Target layout: `dir / file` — required if source is file-layout and the user wants dir.

4. **Show a plan.** Print: "Promoting `<source>` → `<target>`. The source will be marked `done`, with `promoted_to: <target>`. The target gets `promoted_from: <source>`." AskUserQuestion `Proceed / Cancel`.

5. **Execute.** Call `promote()` from `lib/promote/orchestrate.js`. Pass `now = today (YYYY-MM-DD)`, `targetLayout`, and any type-specific `extras` (e.g., `ticket_id`, `project`).

6. **Report.** Tell the user the new entry's path and remind them the source is preserved (audit trail), not deleted.

## Invariants

- Never overwrite an existing target — orchestrate.js refuses; surface the error and ask the user for a different id.
- Never delete the source. If the user wants it gone, instruct them to `rm` it manually.
- `extras` must include `ticket_id` when target type is `ticketed`; otherwise the data will be inconsistent. Ask if missing.
