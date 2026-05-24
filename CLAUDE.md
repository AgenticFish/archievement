# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

`archievement` is a Claude Code plugin: a private work-memory archiver. It takes content from a Claude Code session (brainstorms, plans, PR summaries, learning logs, ideas) and writes it as structured markdown under a user-chosen root directory (default `~/archievement/`). It also generates progress reports and personal performance-review drafts.

The core design rule is **"sink, not source"**: the plugin consumes context that other tools / MCPs / the user have already loaded into the session. It does **not** call external APIs (no JIRA, GitHub, Slack, etc.). This makes the plugin vendor-neutral, dependency-free, and immune to expired tokens or rate limits.

## Reference documents

Read these before making non-trivial changes:

- **Design spec:** [`docs/superpowers/specs/2026-05-23-archievement-plugin-design.md`](docs/superpowers/specs/2026-05-23-archievement-plugin-design.md) — locked-in design decisions (data model, interaction model, hard category isolation between `work` and `personal`).
- **Implementation plan:** [`docs/superpowers/plans/2026-05-23-archievement-implementation.md`](docs/superpowers/plans/2026-05-23-archievement-implementation.md) — TDD-style 36-task sequence, organized into 8 sections, each shipped as one PR.

## Tech stack

- **Runtime:** Node.js 20+ with ESM (`"type": "module"`)
- **Style:** plain JavaScript + JSDoc (no TypeScript build step)
- **Dependencies:** `gray-matter` (YAML frontmatter parsing), `js-yaml` (config files)
- **Dev dependencies:** `prettier` only
- **Test runner:** built-in `node:test` (no Jest, no Mocha)

## Build & test commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm test` | Run all tests |
| `npm run format` | Auto-format with Prettier |
| `npm run format:check` | Check formatting (used in CI) |

The `npm test` script uses `find test -name '*.test.js'` to enumerate test files explicitly. Plain `node --test test/` fails on Node 25+ (directory path interpreted as a module) and `node --test 'test/**/*.test.js'` fails on Node 20 (no glob expansion). See PR #4 for the full compatibility table.

## CI

`.github/workflows/ci.yml` runs two parallel jobs on `ubuntu-latest` with Node 20:

- **`format`** — `npm ci` + `prettier --check` + `shellcheck` on bash files in `hooks/` (defensively skips if no hooks yet)
- **`test`** — `npm ci` + `npm test`

Triggers: push to `main`, all pull requests.

## Repository layout

```
.claude-plugin/plugin.json     plugin manifest (name, version, repo, license, keywords)
.github/workflows/ci.yml       CI workflow
.prettierrc / .prettierignore  Prettier config (100 col, doublequotes, trailing-comma all, semis)
package.json                   ESM, Node >=20, deps + scripts
docs/superpowers/              spec + plan (hand-formatted markdown — Prettier ignores *.md)
hooks/                         populated in §7 — bash wrappers + cross-platform run-hook.cmd
lib/
  config/                      global.yml / projects.yml / user-prefs.yml R/W (§2)
  git.js                       remote detection + URL normalization (§2)
  frontmatter.js               YAML frontmatter R/W (§3, pending)
  entries/                     canonical entry CRUD (§3, pending)
  promote/                     file → dir promotion + reciprocal audit-trail links (§4, pending)
  reports/                     stats / summary / completion / prediction / perf-review (§5, pending)
  hooks/                       SessionStart + PostToolUse hook logic (§7, pending)
skills/                        populated in §6 — 4 user-facing skill markdowns
  setup / record / promote / report
test/                          mirrors lib/ structure
  helpers/tmp.js               withTmpDir(fn) — isolated tmp dirs for filesystem tests
```

Empty directories carry `.gitkeep` placeholders, which are `git rm`'d as real files arrive.

## Conventions

- **PR titles:** lead with an imperative verb (`Add` / `Fix` / `Refactor` / `Remove`). No gerunds (`Adding…`), no conventional-commits prefix (`feat:`).
- **One PR per plan section:** §1, §2, …, §8 each ship as a single PR. CLAUDE.md updates are added alongside or directly after each section.
- **Anonymized examples in docs:** spec, plan, README, and code comments use generic placeholders (`project-a`, `~/archievement`, `PROJ-123`) rather than real company or personal identifiers.
- **Frontmatter is English:** all YAML frontmatter in entry / report files is English. The body prose follows the user's language preference, set in `user-prefs.yml` (introduced in §2).

## Execution status

| Section | Status | Tasks |
| --- | --- | --- |
| §1 Foundation | ✅ Merged (PR #4) | 1-6 — plugin metadata, test infra, Prettier, CI, dir skeleton, tmp helper |
| §2 Config | ✅ Merged (PR #6) | 7-10 — global / projects (with matcher) / user-prefs YAML R/W; git remote detection & normalization |
| §3 Entries | ⏳ Pending | 11-16 |
| §4 Promote | ⏳ Pending | 17-19 |
| §5 Reports | ⏳ Pending | 20-25 |
| §6 Skills | ⏳ Pending | 26-29 |
| §7 Hooks | ⏳ Pending | 30-33 |
| §8 Polish | ⏳ Pending | 34-36 |

Update this table when each section's PR merges.
