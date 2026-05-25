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

Answer the prompts about where to keep the archievement folder (default `~/archievement`) and your preferred output language.

## Daily use

- `/archievement:record` — capture session content (brainstorm, plan, PR summary, progress, idea) into an entry.
- `/archievement:promote` — promote an idea or unticketed entry to its next form, possibly across categories.
- `/archievement:report` — generate `summary`, `completion`, `prediction`, or `perf-review` reports.

## Data model

Two orthogonal axes describe every entry:

- **Category**: `work` or `personal`
- **Type**: `ticketed`, `unticketed`, `learning`, or `idea`

Each entry is markdown with YAML frontmatter, stored at `<archievement_root>/<category>/<type>/<id>/` (dir layout) or `<archievement_root>/<category>/<type>/<id>.md` (file layout).

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
