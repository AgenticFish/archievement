# archievement

A private Claude Code plugin that turns session content into a structured local markdown archive of your work, side projects, learning, and ideas — and generates progress reports and performance-review drafts from it.

> See [`docs/superpowers/specs/2026-05-23-archievement-plugin-design.md`](docs/superpowers/specs/2026-05-23-archievement-plugin-design.md) for the full design.

## Install (local development)

```bash
git clone git@github.com:AgenticFish/archievement.git
cd archievement
npm install
```

Then add the plugin to Claude Code via your plugin marketplace config, pointing at this checkout.

## First-time setup

In any Claude Code session, run:

```
/archievement:setup
```

Answer the prompts about where to keep the archievement folder (suggested `~/archievement`) and your preferred output language. The setup writes a single unified config at `${CLAUDE_PLUGIN_DATA}/config.yml` (root path + language + stale-days + project registrations + ignore patterns) — Claude Code (>= 2.1.78) creates that directory per plugin under `~/.claude/plugins/data/<plugin-id>/`, and it survives plugin updates.

## Daily use

- `/archievement:record` — capture session content (brainstorm, plan, PR summary, progress, idea) into an entry.
- `/archievement:promote` — promote an idea or unticketed entry to its next form, possibly across categories.
- `/archievement:report` — generate `summary`, `completion`, `prediction`, or `perf-review` reports.
- `/archievement:project-setup` — view, register, modify, or ignore the current project's config (slug, category, language).
- `/archievement:find` — locate or recall an archieved entry by filename/slug, topic/keyword, or frontmatter (read-only).

## Data model

Two orthogonal axes describe every entry:

- **Category**: `work` or `personal`
- **Type**: `ticketed`, `unticketed`, `learning`, or `idea`

Each entry is markdown with YAML frontmatter, stored at `<archievement_root>/<category>/<type>/<id>/` (dir layout) or `<archievement_root>/<category>/<type>/<id>.md` (file layout).

The `<id>` itself encodes the owning project as `<project-slug>_<entry-slug>`, so a filename names its project at a glance — e.g. `personal/unticketed/archievement-plugin_find-skill.md`, `work/ticketed/egs-mobile_EGA-5971-voice-refactor.md`. The `_` is the sole delimiter (exactly once; neither segment contains `_`); an entry with no project uses the literal `tbd` (e.g. `personal/idea/tbd_mcp-transport.md`). The directory layout stays a clean `category`/`type` grid — the project lives in the filename, not as a directory level. Frontmatter `project` remains authoritative; the filename segment mirrors it.

## Tech

- Node.js 20+ (ESM)
- `js-yaml`, `gray-matter`
- Testing: `node:test`
- Formatting: Prettier; shell scripts checked by `shellcheck` in CI

## Out of scope (deliberately)

- No external API calls (JIRA, GitHub, Slack, etc.)
- No automatic git operations on the archievement folder
- No concurrency safety — do not edit the same entry from two sessions at once
- No automatic status changes — `status` is always set explicitly by the user
- No UI beyond Claude Code skill prompts

## Acknowledgments

`hooks/run-hook.cmd` adapted from [superpowers](https://github.com/obra/superpowers) by Jesse Vincent (MIT).

## License

MIT
