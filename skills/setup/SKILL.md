---
name: setup
description: Initialize archievement on first install — asks where to put the archievement folder and the default language, creates directory skeleton, writes config files.
---

# archievement:setup

Run this once after installing the plugin. Subsequent runs detect an existing setup and refuse to overwrite without confirmation.

## Goal

Create the archievement folder (content only) and write the unified plugin config at `${CLAUDE_PLUGIN_DATA}/config.yml` so every other archievement skill and hook can resolve the root and read user prefs / project registrations from any working directory.

## Flow

1. **Detect existing setup.** Call `resolveArchievementRoot()` from `lib/config/plugin.js`. Pass the plugin-data path explicitly — Claude Code substitutes `${CLAUDE_PLUGIN_DATA}` here, but does NOT inject it as an env var into the Bash subprocess:

   ```
   node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ resolveArchievementRoot }) => process.stdout.write(resolveArchievementRoot({ pluginConfigPath: '${CLAUDE_PLUGIN_DATA}/config.yml' }) ?? ''))"
   ```

   - If the output is non-empty AND the directory exists, AskUserQuestion: "archievement is already set up at `<path>`. Re-initialize?" options `Keep existing` / `Re-run setup`. Stop if they choose Keep.
   - If a legacy `~/.archievementrc` or legacy `<root>/config/*.yml` was present, the resolver call already migrated everything to the unified plugin-data config — surface that to the user in the final confirmation.

2. **Ask where the archievement folder goes.** AskUserQuestion: "Where should the archievement folder live?" options `~/archievement (suggested)` / `specify a different path`. The user must pick — there is no silent default. If they pick "specify", prompt the user to type the path. Expand `~`.

3. **Ask default language.** Inspect the user's message language in this session and any `languages_known` already in the plugin-data config (use `loadConfig` if non-trivial). Construct AskUserQuestion options dynamically: the detected language plus English. If only English is detected, ask `Confirm: English` / `Specify another`.

4. **Create directory skeleton** via Bash. The archievement root holds content only — no `config/` subdir (all config lives in plugin-data):

   ```
   mkdir -p "$ROOT"/{work/{ticketed,unticketed,learning,idea},personal/{ticketed,unticketed,learning,idea},reports/perf-review}
   ```

5. **Write the unified plugin config** at `${CLAUDE_PLUGIN_DATA}/config.yml` via `saveConfig` from `lib/config/plugin.js`. Pass the path explicitly so the helper doesn't try to read the `CLAUDE_PLUGIN_DATA` env var (which is not present in Bash-tool subprocesses):

   ```
   node -e "
     import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ saveConfig }) =>
       saveConfig(
         { pluginConfigPath: '${CLAUDE_PLUGIN_DATA}/config.yml' },
         {
           archievement_root: '$ROOT',
           default_language: '$LANG',
           stale_days: 21,
           languages_known: ['$LANG', 'en'].filter((v, i, a) => a.indexOf(v) === i),
           projects: [],
           ignore: [],
         }
       )
     );
   "
   ```

   Requires Claude Code >= 2.1.78, which substitutes `${CLAUDE_PLUGIN_DATA}` inline in skill content.

6. **Confirm completion.** Tell the user:
   - Where the archievement folder was written (content only — no `config/` subdir anymore)
   - Where the plugin config was written (`${CLAUDE_PLUGIN_DATA}/config.yml`)
   - If a legacy `~/.archievementrc` or `<root>/config/*.yml` was migrated and removed, mention it (the resolver in step 1 already did this transparently)
   - The next step (probably `/archievement:record`)

## Edge cases

- The chosen path's parent directory doesn't exist → create it.
- The chosen path already exists and is non-empty → AskUserQuestion to confirm before writing anything.
- The user is currently inside an existing archievement root → warn but proceed.
- Path expansion of `~` must use the current user's home dir from `$HOME`.
