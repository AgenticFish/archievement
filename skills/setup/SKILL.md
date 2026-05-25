---
name: setup
description: Initialize archievement on first install — asks where to put the archievement folder and the default language, creates directory skeleton, writes config files.
---

# archievement:setup

Run this once after installing the plugin. Subsequent runs detect an existing setup and refuse to overwrite without confirmation.

## Goal

Create the archievement folder and its config files, then write a discovery pointer at `~/.archievementrc` so other archievement skills can find the root from any working directory.

## Flow

1. **Detect existing setup.** Read `~/.archievementrc`. If it exists and points to a directory containing `config/global.yml`, ask the user via AskUserQuestion: "archievement is already set up at `<path>`. Re-initialize?" with options `Keep existing` / `Re-run setup`. Stop if they choose Keep.

2. **Ask where the archievement folder goes.** AskUserQuestion: "Where should the archievement folder live?" options `~/archievement (default)` / `specify a different path`. If they pick "specify", prompt the user to type the path. Expand `~`.

3. **Ask default language.** First inspect the user's message language in this session and any languages already in `config/user-prefs.yml` (if it exists at the resolved root). Construct AskUserQuestion options dynamically: the detected language plus English. If only English is detected, ask `Confirm: English` / `Specify another`.

4. **Create directory skeleton** via Bash:

   ```
   mkdir -p "$ROOT"/{work/{ticketed,unticketed,learning,idea},personal/{ticketed,unticketed,learning,idea},reports/perf-review,config}
   ```

5. **Write `config/global.yml`** using the helpers in `lib/config/global.js`. The script invocation looks like:

   ```
   node -e "
     import('${CLAUDE_PLUGIN_ROOT}/lib/config/global.js').then(({ writeGlobalConfig }) =>
       writeGlobalConfig('$ROOT/config/global.yml', {
         default_language: '$LANG',
         stale_days: 21,
         archievement_root: '$ROOT',
       })
     );
   "
   ```

6. **Write `config/projects.yml`** with empty arrays via `lib/config/projects.js`.

7. **Write `config/user-prefs.yml`** with `languages_known: [<chosen>, "en"]` (deduped).

8. **Write `~/.archievementrc`.** Just the absolute path on a single line.

9. **Confirm completion.** Tell the user where files were written and what the next step is (probably `/archievement:record`).

## Edge cases

- The chosen path's parent directory doesn't exist → create it.
- The chosen path already exists and is non-empty → AskUserQuestion to confirm before writing anything.
- The user is currently inside an existing archievement root → warn but proceed.
- Path expansion of `~` must use the current user's home dir from `$HOME`.
