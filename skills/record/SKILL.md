---
name: record
description: Distill the current Claude Code session into an archievement entry — creates or updates an entry, asks scope and content type via AskUserQuestion before writing.
---

# archievement:record

## When to use

Invoke when the user wants to save part of the current session: brainstorm, plan, PR summary, progress note, raw idea, or learning log.

## Read first

Before any prompting, read the runtime state:

1. **archievement root**: resolve via `lib/config/plugin.js`. Pass the plugin-data path explicitly — Claude Code substitutes `${CLAUDE_PLUGIN_DATA}` here, but does NOT inject it as an env var into the Bash subprocess:

   ```
   node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ resolveArchievementRoot }) => process.stdout.write(resolveArchievementRoot({ pluginConfigPath: '${CLAUDE_PLUGIN_DATA}/config.yml' }) ?? ''))"
   ```

   If the output is empty, STOP. Tell the user: "archievement is not set up. Run `/archievement:setup` first, then re-invoke this skill." Do NOT proceed, do NOT search the filesystem, do NOT use a default path.

2. **Project context**: if a `<archievement-context>` block was injected by the SessionStart hook, parse it. It tells you the project slug, category, language, and the list of active entries (`todo` + `in-progress`).
3. **Current Node module paths**: helpers live under `${CLAUDE_PLUGIN_ROOT}/lib/`. Use them via `node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/<path>').then(...)"` or by writing a small driver to a tmp file and executing it. Never re-implement entry CRUD inline.

## Flow

1. **Determine intent — new vs. update.** AskUserQuestion: "What are you recording?" with options:
   - `Update an existing entry` (only show this option if active entries exist in context)
   - `Create a new entry`

2. **If updating an existing entry:**
   a. AskUserQuestion: "Which entry?" with options drawn from the active entries list, plus a `Search all entries` escape hatch.
   b. AskUserQuestion: "What doc?" options `progress / brainstorm / plan / tasks / pr-summary / new section in main body`. (`pr-summary` only valid for dir-layout entries.)
   c. AskUserQuestion: "What scope of the session content?" options `entire session / last N turns (pick N) / I'll specify a range / I'll tell you the content directly`.
   d. Pull content from session accordingly. For PR summaries, also pull the PR ID, title, URL from context (look for the `<archievement-nudge>` block that the `gh pr create` hook injected, or ask the user).
   e. Draft the markdown section. Use the language resolved from project's language (frontmatter `language` in projects.yml entry) → falling back to global default.
   f. Show the user the draft. AskUserQuestion: `Save / Let me edit / Cancel`.
   g. On save: call `appendToDoc` or `writeSiblingDoc` (for pr-summaries) from `lib/entries/update.js`. Also call `updateEntryFrontmatter` to bump `updated`.
   h. AskUserQuestion: "Update status?" options `Leave as is / todo / in-progress / done`. If changed, call `updateEntryFrontmatter`.

3. **If creating a new entry:**
   a. AskUserQuestion category. If cwd context says work or personal, offer that as default; otherwise: `work / personal`.
   b. AskUserQuestion type: `ticketed / unticketed / learning / idea`.
   c. For `ticketed`: ask the ticket ID (free-form). For others: ask a slug (kebab-case).
   d. AskUserQuestion layout (skip for `idea` — always file): `dir (complex, expandable) / file (lightweight, expandable later)`.
   e. AskUserQuestion: "What's the initial doc?" options `brainstorm / plan / I'll just create the entry with no body yet`.
   f. Scope question (same as above).
   g. Draft body.
   h. Confirm + save: call `createEntry` from `lib/entries/create.js`.

4. **Final report.** Tell the user the on-disk path of the file you wrote and the new entry's status.

## Invariants

- **Never write to disk without an explicit Save confirmation from the user.**
- **Never invent ticket IDs, slugs, project names, or content.** Always pull from session context or AskUserQuestion.
- **Status changes are always explicit.** The skill never sets status to `in-progress` or `done` based on inference; it only changes status when the user picks an option.
- **Frontmatter is always English.** Body prose follows the resolved language.

## Cross-skill calls

- If the user describes promotion intent ("turn this idea into a ticket"), call `/archievement:promote` via the Skill tool instead of trying to handle it inline.
- If the user asks for a report, call `/archievement:report` instead.
