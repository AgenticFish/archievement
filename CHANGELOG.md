# Changelog

All notable changes to the `archievement` plugin are recorded here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-06-08

### Added

- **New `find` skill** (`/archievement:find`) — the 6th user-facing skill. Locates or recalls an archieved entry by filename/slug (Glob), topic/keyword (full-text Grep over `work/` + `personal/`, `reports/` excluded), or frontmatter facets (`listEntries`). It **always resolves the archievement root first** and searches inside it — never the cwd or the plugin source repo — fixing a class of bug where a recall request grepped the wrong tree. Read-only; hands off to `record`/`promote` for edits. The SessionStart hook now also injects the `archievement root:` line into its match/unregistered context. ([#31](https://github.com/AgenticFish/archievement/pull/31))
- **Project slug encoded in every entry id: `<project-slug>_<entry-slug>`.** A filename now names its owning project at a glance (e.g. `personal/unticketed/archievement-plugin_find-skill.md`, `work/ticketed/egs-mobile_EGA-5971-voice-refactor.md`); an entry with no project uses the literal `tbd` placeholder. The `_` is the sole delimiter (exactly once; neither segment contains `_`). New helpers in `lib/entries/path.js`: `makeId(projectSlug, entrySlug)` (the sole id-construction point — defaults a falsy project to `tbd`, throws on an `_` in either segment) and `projectOf(ptr)` (reads the project segment). The directory layout (`<category>/<type>/`) is unchanged — project lives in the filename, not a directory level. Frontmatter `project` stays authoritative; the filename segment mirrors it. ([#34](https://github.com/AgenticFish/archievement/pull/34))

### Changed

- **`slugOf` is now a two-stage parse.** It strips the `<project-slug>_` segment first, then (for `ticketed`) the `^[A-Z][A-Z0-9]*-\d+-` ticket prefix, recovering the cross-promote entry-slug. Because the project segment is stripped before comparison, **`promote` now preserves the entry-slug while allowing the project segment to be filled in or changed** on graduation (e.g. a `tbd_` idea acquires its real project). `orchestrate.js` and `prediction-status.js` are unchanged — they inherit the new behavior through `slugOf`. The `record` / `promote` / `find` skill prose is updated to build and describe the new id shape. ([#34](https://github.com/AgenticFish/archievement/pull/34))

### Removed

- **Legacy config-migration path.** The one-time migration that absorbed three pre-1.0 config sources (`~/.archievementrc` and `<root>/config/{global,projects,user-prefs}.yml`) into the unified `${CLAUDE_PLUGIN_DATA}/config.yml` is gone (`applyLegacyMigrations`, `readYaml`, `LEGACY_ROOT_CONFIG_FILES`, and the `legacyRcPath` config option). Those formats were superseded in #17/#19 and the migration has long since run for every live install. `loadConfig` is now a straight read-`config.yml` + merge-defaults function (−137 lines). This is a clean break — there is no fallback for the old config shapes or for old bare-slug entry ids; pre-convention on-disk data is out of scope and is not migrated. ([#33](https://github.com/AgenticFish/archievement/pull/33))

### Tests

- 136 → 137. Rewrote the `slugOf` suite for the two-stage `<project>_<slug>` encoding and added `projectOf` / `makeId` / promote-slug-preservation-across-project-change suites; updated the promote and prediction-status fixtures to the new id shape. Removed the 9 config-migration tests. `test/skills.test.js` auto-covers the new `find` skill.

## [0.2.0] - 2026-06-01

### Added

- **New `project-setup` skill** (`/archievement:project-setup`) — the 5th user-facing skill. A cwd-centric tool to view, register, modify, or ignore the current project's config (slug / category / language), closing the gap where the unified `${CLAUDE_PLUGIN_DATA}/config.yml` could previously only be hand-edited. It presents a `show` / `configure` / `ignore` menu with smart upsert: `configure` registers the cwd when it is unknown and modifies (or removes) it when it already matches, while `ignore` toggles the cwd on the ignore list. Distinct from the one-time global `setup` skill. ([#29](https://github.com/AgenticFish/archievement/pull/29))
- **Three pure config helpers** in `lib/config/plugin.js`: `updateProject(config, slug, patch)`, `removeProject(config, slug)`, and `removeIgnore(config, probe)`. `removeIgnore` is probe-based and reuses the private `matcherMatches`, making unignore the exact inverse of `matchProject`'s `ignored` classification. ([#29](https://github.com/AgenticFish/archievement/pull/29))

### Changed

- **The SessionStart unregistered-project nudge now names the skill** — it points the user at `/archievement:project-setup` to register or ignore the current directory, instead of a generic "if any archievement skill is invoked" hint. ([#29](https://github.com/AgenticFish/archievement/pull/29))

### Tests

- 129 → 136. New `updateProject` / `removeProject` / `removeIgnore` unit tests (merge / no-op, filter / no-op, probe-match by path and git-remote), plus a session-start assertion that the nudge names the skill. `test/skills.test.js` auto-covers the new `project-setup` skill.

## [0.1.8] - 2026-05-29

### Changed

- **`promote` now graduates the source instead of preserving an audit trail.** Promotion copies the entry's content (and, for dir-layout sources, all sibling attachments) to the target, then **deletes the source**. The `promoted_from`/`promoted_to` reciprocal links are retired everywhere — the slug, preserved across the move, is the identity. This keeps `idea/` to live `todo` items only (graduated ideas leave the backlog) and makes the promote destination — already a content superset of the source — the single record. `completion` reports dropped their now-dead "Promoted from idea" bucket; graduated work appears as its real done entry. ([#27](https://github.com/AgenticFish/archievement/pull/27))
- **Prediction status tables resolve by slug, not `promoted_to`.** Each row is resolved by locating the entry that currently carries its slug (across `idea`/`unticketed`/`ticketed`) and reporting that entry's real current status (`todo`/`in-progress`/`done`), or `removed` if the slug exists nowhere — strictly more truthful than the old frozen `→ <promoted_to>` cell. ([#27](https://github.com/AgenticFish/archievement/pull/27))

### Added

- **`slugOf(ptr)`** (`lib/entries/path.js`) — recovers the stable slug from any entry pointer. The slug is encoded in every filename: `<slug>.md` for idea/unticketed/learning, `<TICKET>-<slug>` for ticketed (the leading `^[A-Z][A-Z0-9]*-\d+-` ticket prefix is stripped). `promote()` enforces slug-preservation (`slugOf(from) === slugOf(to)`). ([#27](https://github.com/AgenticFish/archievement/pull/27))
- **`idea` entries are now always file-layout.** `createEntry` rejects a dir-layout `idea`; dir-layout work belongs on the unticketed/ticketed entry an idea graduates into. ([#27](https://github.com/AgenticFish/archievement/pull/27))

### Tests

- 120 → 129. `slugOf` (+4 incl. legacy/no-suffix and digit-leading slug), `createEntry` idea-dir guard (+2), rewritten `moveEntry`/`promote` graduate + slug-invariant suites, `completion` no-bucket regression test, and `resolveStatus` rewritten to slug-locate / real-status / `removed`.

## [0.1.7] - 2026-05-29

### Added

- **Prediction reports embed a refreshable status table.** Each newly generated `prediction` report now includes an anchored markdown table (`<!-- archievement:status-table:start --> … :end -->`) listing every covered idea and its status, resolved deterministically from entry frontmatter (own status, `→ <promoted_to> (<target_status>)`, or `gone`). A new `refresh-prediction-status` branch on `/archievement:report` re-resolves the table of an existing report in place without an LLM call — prose stays frozen, the status column refreshes. Reports predating the feature throw `MissingAnchorsError` cleanly. Generation and refresh share one renderer via `lib/reports/prediction-status.js` (`freshenStatusTable` / `refreshReportFile`). First report-side use of the "frozen LLM prose + refreshable deterministic block" pattern. ([#25](https://github.com/AgenticFish/archievement/pull/25))

### Tests

- 109 → 120. New `test/reports/prediction-status.test.js` (+11): render, parse, status resolution across 4 cell variants, freshen (success + missing-anchors), and `refreshReportFile` round-trip + idempotence.

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
