---
name: project-setup
description: View, register, modify, or ignore the current project's archievement config (slug, category, language). Distinct from setup, which is the one-time global initialization.
---

# archievement:project-setup

Manage how the **current working directory** is registered in archievement's
unified config: view all registrations, register/modify the current project, or
toggle it on the ignore list.

> Not to be confused with `/archievement:setup`. `setup` is the **one-time
> global** initialization (root path, default language, directory skeleton).
> `project-setup` is the **recurring per-project** registration tool. It only
> reads and writes the local config — it calls no external API.

## Read first

1. **archievement root**: resolve via `lib/config/plugin.js`. Pass the
   plugin-data path explicitly — Claude Code substitutes `${CLAUDE_PLUGIN_DATA}`
   in skill content, but does NOT inject it as an env var into the Bash
   subprocess:

   ```
   node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ resolveArchievementRoot }) => process.stdout.write(resolveArchievementRoot({ pluginConfigPath: '${CLAUDE_PLUGIN_DATA}/config.yml' }) ?? ''))"
   ```

   If the output is empty, STOP. Tell the user: "archievement is not set up. Run
   `/archievement:setup` first." Do NOT search the filesystem or use a default
   path.

2. **Classify the current cwd**: run one snippet to get the probe, the match
   result, and the lists needed to render the menu and prompts:

   ```
   node -e "
     Promise.all([
       import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js'),
       import('${CLAUDE_PLUGIN_ROOT}/lib/git.js'),
     ]).then(([{ loadConfig, matchProject }, { getProjectProbe }]) => {
       const cfg = loadConfig({ pluginConfigPath: '${CLAUDE_PLUGIN_DATA}/config.yml' });
       const probe = getProjectProbe(process.cwd());
       process.stdout.write(JSON.stringify({
         probe,
         result: matchProject(cfg, probe),
         projects: cfg.projects,
         ignore: cfg.ignore,
         languages_known: cfg.languages_known,
         default_language: cfg.default_language,
       }));
     });
   "
   ```

   `result.kind` is `match`, `ignored`, or `unknown`. Use it to label the menu.

## Flow

Top-level AskUserQuestion — "What do you want to do?" with three options, their
descriptions reflecting the current cwd state:

| Option | Description shown |
|---|---|
| **show** | List all registered projects + the ignore list (read-only). |
| **configure** | Register this project (if `unknown`) or modify/remove it (if `match`). If `ignored`, tell the user this directory is on the ignore list and to use **ignore** to unignore it first. |
| **ignore** | Add this directory to the ignore list (if not ignored) or remove it (if `ignored`). |

### show

Print the `projects` and `ignore` arrays from the classify snippet in a readable
form. Mark the entry whose match equals the current `probe` (i.e. `result.kind
=== "match"` / `"ignored"`). Make no writes.

### configure — when `result.kind === "unknown"` (register)

1. AskUserQuestion **slug** (kebab-case). If the slug already appears in
   `projects`, warn but allow.
2. AskUserQuestion **category**: `work / personal`.
3. AskUserQuestion **language**: build options from `languages_known` plus
   `English`, mirroring the `setup` skill. Allow "specify another".
4. Build the matcher from the probe: `git-remote` with `probe.remote` when it is
   non-null, otherwise `path` with `probe.cwd`. Then write:

   ```
   node -e "
     import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ loadConfig, addProject, saveConfig }) => {
       const p = '${CLAUDE_PLUGIN_DATA}/config.yml';
       const cfg = loadConfig({ pluginConfigPath: p });
       const match = REMOTE ? { type: 'git-remote', url: REMOTE } : { type: 'path', path: CWD };
       saveConfig({ pluginConfigPath: p }, addProject(cfg, { match, slug: SLUG, category: CATEGORY, language: LANGUAGE }));
     });
   "
   ```

   Substitute `REMOTE` / `CWD` / `SLUG` / `CATEGORY` / `LANGUAGE` with quoted JS
   string literals (or `null` for `REMOTE` when there is no remote).

### configure — when `result.kind === "match"` (modify / remove)

1. Show the current `slug` / `category` / `language` from `result.project`.
2. AskUserQuestion: `Modify a field / Remove this registration / Cancel`.
3. **Modify**: AskUserQuestion which field (`slug / category / language`),
   collect the new value, then write with `updateProject` keyed by the CURRENT
   slug:

   ```
   node -e "
     import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ loadConfig, updateProject, saveConfig }) => {
       const p = '${CLAUDE_PLUGIN_DATA}/config.yml';
       const cfg = loadConfig({ pluginConfigPath: p });
       saveConfig({ pluginConfigPath: p }, updateProject(cfg, CURRENT_SLUG, PATCH));
     });
   "
   ```

   `PATCH` is a JS object literal of only the changed fields, e.g. `{ category: 'personal' }`.

4. **Remove**: confirm, then `removeProject(cfg, CURRENT_SLUG)`:

   ```
   node -e "
     import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ loadConfig, removeProject, saveConfig }) => {
       const p = '${CLAUDE_PLUGIN_DATA}/config.yml';
       const cfg = loadConfig({ pluginConfigPath: p });
       saveConfig({ pluginConfigPath: p }, removeProject(cfg, CURRENT_SLUG));
     });
   "
   ```

### ignore — toggle

- When `result.kind !== "ignored"`: add the current directory. Build the matcher
  exactly as in register (git-remote when `probe.remote`, else path) and call
  `addIgnore`:

  ```
  node -e "
    import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ loadConfig, addIgnore, saveConfig }) => {
      const p = '${CLAUDE_PLUGIN_DATA}/config.yml';
      const cfg = loadConfig({ pluginConfigPath: p });
      const match = REMOTE ? { type: 'git-remote', url: REMOTE } : { type: 'path', path: CWD };
      saveConfig({ pluginConfigPath: p }, addIgnore(cfg, { match }));
    });
  "
  ```

- When `result.kind === "ignored"`: remove it by passing the probe to
  `removeIgnore`:

  ```
  node -e "
    Promise.all([
      import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js'),
      import('${CLAUDE_PLUGIN_ROOT}/lib/git.js'),
    ]).then(([{ loadConfig, removeIgnore, saveConfig }, { getProjectProbe }]) => {
      const p = '${CLAUDE_PLUGIN_DATA}/config.yml';
      const cfg = loadConfig({ pluginConfigPath: p });
      saveConfig({ pluginConfigPath: p }, removeIgnore(cfg, getProjectProbe(process.cwd())));
    });
  "
  ```

## Final report

After any write, tell the user exactly what changed (registered / modified which
field / removed / ignored / unignored) and the slug or path affected. For `show`,
just present the lists.

## Invariants

- **Never write without an explicit confirmation** for that specific action.
- **Never invent a slug, category, language, or path.** Pull from the probe or
  AskUserQuestion.
- **All operations target the current cwd.** To manage a different project, the
  user must `cd` there first; there is no cross-directory target picker.
- **Config is the single unified `${CLAUDE_PLUGIN_DATA}/config.yml`.** Never
  hand-edit YAML or write to a `<root>/config/` path.
