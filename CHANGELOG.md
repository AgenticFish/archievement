# Changelog

All notable changes to the `archievement` plugin are recorded here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.6] - 2026-05-28

### Changed

- **`appendToDoc` split into `appendToBody` and `appendToSiblingDoc`.** The old 4-arg signature with `docName` ignored-on-file-layout was a silent footgun. `appendToBody(root, ptr, text)` appends to the entry's main body (file-layout: the `.md` file; dir-layout: `<dir>/index.md`). `appendToSiblingDoc(root, ptr, docName, text)` appends to `<dir>/<docName>.md`; throws on file-layout. `appendToDoc` is deleted. `skills/record/SKILL.md` step 2b now adapts the doc menu to layout; step 2g routes each doc choice to the correct helper. ([#23](https://github.com/AgenticFish/archievement/pull/23))

### Fixed

- **`appendBody` throws `TypeError` on non-string `text`.** Previously a non-string was silently coerced via `String(text)`, so a 3-arg `appendToDoc(root, ptr, section)` call (natural for file-layout where `docName` is ignored) wrote the literal string `"undefined"` to the entry body. `appendToSiblingDoc` carries the same guard (sibling-doc writes bypass `appendBody`). ([#22](https://github.com/AgenticFish/archievement/pull/22))
- **`appendToBody` on dir-layout entries now correctly appends to `<dir>/index.md`.** Latent bug from the old `appendToDoc`: picking "new section in main body" silently wrote to `<dir>/main-body.md` (a sibling) instead of the body. ([#23](https://github.com/AgenticFish/archievement/pull/23))

### Tests

- 106 → 109. `appendBody` non-string guard (+1), and the `appendToBody` / `appendToSiblingDoc` split tests (+2 net after removing the two old `appendToDoc` tests).

## [0.1.5] - 2026-05-27

### Added

- **`/archievement:report` exposes a project filter for `summary` and `completion`.** Options are built dynamically from `config.projects`: `all projects` + one option per registered slug + `unregistered (no project field)`. Skipped when no projects are registered. The chosen filter is recorded in the report frontmatter as `project_filter`. `prediction` (cross-project by design) and `perf-review` (category-scoped) are unchanged. ([#20](https://github.com/AgenticFish/archievement/pull/20))

## [0.1.4] - 2026-05-26

### Changed

- **All plugin runtime config consolidated into a single `${CLAUDE_PLUGIN_DATA}/config.yml`.** `default_language`, `stale_days`, `languages_known`, `projects`, and `ignore` now live in one place; the per-file modules under `<root>/config/{global,projects,user-prefs}.yml` are gone. The archievement root contains only content (`work/`, `personal/`, `reports/`). Lazy migration absorbs legacy files on first load and unlinks them; `<root>/config/` is removed if empty. ([#19](https://github.com/AgenticFish/archievement/pull/19))

## [0.1.3] - 2026-05-26

### Fixed

- **Skills no longer throw `CLAUDE_PLUGIN_DATA is not set` on first invocation.** `${CLAUDE_PLUGIN_DATA}` is template-substituted in SKILL.md content but is NOT injected as an env var into Bash-tool subprocesses. Skills (`record`, `report`, `promote`, `setup`) now pass `pluginConfigPath: '${CLAUDE_PLUGIN_DATA}/config.yml'` explicitly to `resolveArchievementRoot()` / `writePluginConfig()`. Lib code unchanged. ([#18](https://github.com/AgenticFish/archievement/pull/18))

## [0.1.2] - 2026-05-26

### Changed

- **`archievement_root` now resolves strictly from `${CLAUDE_PLUGIN_DATA}/config.yml`** via `resolveArchievementRoot()`. No silent default; if the config is missing every skill stops and instructs the user to run `/archievement:setup`. The plugin-data config is the single source of truth for the root. ([#17](https://github.com/AgenticFish/archievement/pull/17))

### Removed

- **`~/.archievementrc` dotfile pointer.** One-time transparent migration on first resolver call writes the new config and unlinks the legacy rc. ([#17](https://github.com/AgenticFish/archievement/pull/17))

## [0.1.1] - 2026-05-25

### Fixed

- **Spec / setup-skill `ideas/` vs `idea/` drift.** The design spec and `skills/setup/SKILL.md` mistakenly referenced `ideas/` (plural) as the entry-type directory while the code implements singular `idea/`. Running the setup skill literally would create unreachable directories. ([#13](https://github.com/AgenticFish/archievement/pull/13))
- **Report timestamps now default to local time, not UTC.** The prior `writeReport` contract left timestamp computation to the caller; the natural `new Date().toISOString()…` is UTC, which crossed the date boundary on US evenings and produced filenames dated one day in the future. `localTimestamp(d?)` is now exported and used as the default. ([#14](https://github.com/AgenticFish/archievement/pull/14))
- **PostToolUse `gh pr create` hook now runs on macOS bash 3.2.** The wrapper used `${INPUT@Q}` (bash 4.4+ only), so every Bash tool invocation hit `bad substitution` on macOS and the nudge silently never fired. Payload now passes through `process.env` instead of shell-quoted interpolation. Same hardening applied to `session-start`. ([#15](https://github.com/AgenticFish/archievement/pull/15))

### Tests

- 86 → 94 (`test/reports/write.test.js` +4 for the timestamp default, `test/hooks/bash-portability.test.js` new with 4 static + behavioral guards).

## [0.1.0] - 2026-05-24

Initial release. End-to-end MVP shipped across 9 PRs (#4-#12):

- Four user-facing skills: `setup`, `record`, `promote`, `report` (summary / completion / prediction / perf-review).
- Config layer: `global.yml`, `projects.yml` (with matcher), `user-prefs.yml`; git remote detection.
- Entry CRUD with file / dir layouts; cross-bucket promotion with reciprocal `promoted_to` / `promoted_from` audit links.
- Report builders with deterministic anchors; perf-review with hard category isolation.
- SessionStart + PostToolUse (`gh pr create`) hooks; cross-platform polyglot runner.
- 86 tests, Prettier, GitHub Actions CI on Node 20.

See [PR #12](https://github.com/AgenticFish/archievement/pull/12) for the full section-by-section breakdown.
