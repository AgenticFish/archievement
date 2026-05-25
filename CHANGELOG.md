# Changelog

All notable changes to the `archievement` plugin are recorded here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
