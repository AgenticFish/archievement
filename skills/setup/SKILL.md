---
name: setup
description: Initialize archievement on first install — asks where to put the archievement folder and the default language, creates directory skeleton, writes config files.
---

# archievement:setup

Run this once after installing the plugin. Subsequent runs detect an existing setup and refuse to overwrite without confirmation.

## Goal

Create the archievement folder and its config files, then write `archievement_root` into the plugin's user-data config at `${CLAUDE_PLUGIN_DATA}/config.yml` so every other archievement skill and hook can resolve the root from any working directory.

## Flow

1. **Detect existing setup.** Call `resolveArchievementRoot()` from `lib/config/plugin.js`:

   ```
   node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ resolveArchievementRoot }) => process.stdout.write(resolveArchievementRoot() ?? ''))"
   ```

   - If the output is non-empty AND the directory contains `config/global.yml`, AskUserQuestion: "archievement is already set up at `<path>`. Re-initialize?" options `Keep existing` / `Re-run setup`. Stop if they choose Keep.
   - If the output is empty but the user had a legacy `~/.archievementrc`, the resolver call already migrated it transparently — surface that to the user in the final confirmation.

2. **Ask where the archievement folder goes.** AskUserQuestion: "Where should the archievement folder live?" options `~/archievement (suggested)` / `specify a different path`. The user must pick — there is no silent default. If they pick "specify", prompt the user to type the path. Expand `~`.

3. **Ask default language.** First inspect the user's message language in this session and any languages already in `config/user-prefs.yml` (if it exists at the resolved root). Construct AskUserQuestion options dynamically: the detected language plus English. If only English is detected, ask `Confirm: English` / `Specify another`.

4. **Create directory skeleton** via Bash:

   ```
   mkdir -p "$ROOT"/{work/{ticketed,unticketed,learning,idea},personal/{ticketed,unticketed,learning,idea},reports/perf-review,config}
   ```

5. **Write `config/global.yml`** using the helpers in `lib/config/global.js`. `archievement_root` is NOT written here — it lives in the plugin-data config (step 8). Script invocation:

   ```
   node -e "
     import('${CLAUDE_PLUGIN_ROOT}/lib/config/global.js').then(({ writeGlobalConfig }) =>
       writeGlobalConfig('$ROOT/config/global.yml', {
         default_language: '$LANG',
         stale_days: 21,
       })
     );
   "
   ```

6. **Write `config/projects.yml`** with empty arrays via `lib/config/projects.js`.

7. **Write `config/user-prefs.yml`** with `languages_known: [<chosen>, "en"]` (deduped).

8. **Write `${CLAUDE_PLUGIN_DATA}/config.yml`** via `writePluginConfig` from `lib/config/plugin.js`:

   ```
   node -e "
     import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ getPluginConfigPath, writePluginConfig }) =>
       writePluginConfig(getPluginConfigPath(), { archievement_root: '$ROOT' })
     );
   "
   ```

   Requires Claude Code >= 2.1.78 (where `CLAUDE_PLUGIN_DATA` is injected). If the env var is missing, the helper throws a clear error.

9. **Confirm completion.** Tell the user:
   - Where the archievement folder was written
   - Where the plugin config was written (`${CLAUDE_PLUGIN_DATA}/config.yml`)
   - If a legacy `~/.archievementrc` was migrated and removed, mention it
   - The next step (probably `/archievement:record`)

## Edge cases

- The chosen path's parent directory doesn't exist → create it.
- The chosen path already exists and is non-empty → AskUserQuestion to confirm before writing anything.
- The user is currently inside an existing archievement root → warn but proceed.
- Path expansion of `~` must use the current user's home dir from `$HOME`.
