---
name: find
description: Use when the user wants to locate or recall something previously archieved — find an entry by filename/slug, by topic/keyword, or by frontmatter (category/type/status/project). Resolves the archievement root first (never searches the cwd or guesses a path), then recalls within it. Triggers on phrasings like "find the archievement file about X", "the idea/note we archieved about Y", "did we archieve anything on Z".
---

# archievement:find

## When to use

Invoke when the user wants to locate or recall content they archieved earlier —
by filename/slug, by topic or keyword, or by frontmatter facets
(category / type / status / project). Typical phrasings: "find the archievement
file about X", "the idea/note we archieved about Y", "did we archieve anything
on Z", "我们之前 archievement 了一个关于 X 的 idea".

This skill is **read-only**. It locates and reads; it never writes. If the user
wants to edit or promote what they find, hand off to `/archievement:record` or
`/archievement:promote`.

## Red line

**Never grep the current working directory or the plugin source repo for
archievement content.** Always resolve the archievement root first and search
*inside the returned root*. The cwd (often a code repo) and the archievement
root are different places, and their names can even collide. Searching the cwd
is the single most common way this task goes wrong.

## Read first

Resolve the archievement root via `lib/config/plugin.js`. Pass the plugin-data
path explicitly — Claude Code substitutes `${CLAUDE_PLUGIN_DATA}` in skill
content, but does NOT inject it as an env var into the Bash subprocess:

```
node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ resolveArchievementRoot }) => process.stdout.write(resolveArchievementRoot({ pluginConfigPath: '${CLAUDE_PLUGIN_DATA}/config.yml' }) ?? ''))"
```

If the output is empty, STOP. Tell the user: "archievement is not set up. Run
`/archievement:setup` first, then re-invoke this skill." Do NOT search the
filesystem, do NOT use a default path.

(If a `<archievement-context>` block already carries an `archievement root:`
line injected by the SessionStart hook, you may use that path — but only as a
shortcut to the same value. Never substitute a guess for the resolved root.)

## Flow

### 1. Extract retrieval signals from the user's request

Decompose the natural-language query into three kinds of signal:

- **Filename / slug keywords** — prefer English tokens likely to appear in file
  names (e.g. `mcp`, `transport`).
  (Filenames are encoded `<project>_<entry-slug>.md`, so a Glob like `**/*find-skill*.md` matches `archievement-plugin_find-skill.md`. A query naming a project — "the archievement-plugin idea about X" — maps the project to the `<project>_` prefix.)
- **Frontmatter hints** — map prose to filters: "idea / 想法" → `type: idea`;
  "learning / 学习笔记" → `type: learning`; "done / 做完的" → `status: done`;
  "work" / "personal" → category; a known project name → `project`.
- **Body keywords** — including non-English terms (e.g. "科普", "transport").

### 2. Recall — search only `<root>/work` and `<root>/personal`

This scope deliberately excludes `<root>/reports` (generated artifacts are not
entry content).

- **Filename:** use the Glob tool with patterns like `**/*<kw>*.md` rooted at
  `<root>/work` and `<root>/personal`.
- **Content:** use the Grep tool, case-insensitive, with a few context lines,
  with `path` set to `<root>/work` and `<root>/personal`. The pattern is the
  body keywords joined with `|`. This searches **all entry documents**:
  file-layout `.md` bodies, dir-layout `index.md`, and dir-layout sibling docs
  (`brainstorm.md`, `plan.md`, `tasks.md`, `pr-summaries/*.md`).
- **Frontmatter facets:** when the query has frontmatter hints, list candidates
  with `listEntries`:

  ```
  node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/entries/list.js').then(({ listEntries }) => process.stdout.write(JSON.stringify(listEntries('<root>', FILTERS))))"
  ```

  Substitute `<root>` and `FILTERS` (a JS object literal, e.g.
  `{ category: 'personal', type: 'idea' }`).

Merge and de-duplicate the candidates. Map any sibling-doc hit (e.g.
`personal/idea/foo/brainstorm.md`) back to its owning entry (`foo`).

### 3. Rank the candidates

Order by signal strength: a filename/slug match outranks an exact frontmatter
match, which outranks a body-only match; candidates matching several signals
rank higher. This is your judgment — there is no computed score.

### 4. Present results

- **Single clear hit** → Read it directly and present it, so the conversation
  can continue without an extra round-trip.
- **Multiple hits** → list each candidate's path, title, and the matching
  snippet, then AskUserQuestion: "Which one do you want to open?"
- **Zero hits** → tell the user nothing matched under the root, show the few
  closest candidates (if any), and suggest broadening the search terms.
- When several hits span different projects, label each with its project
  (the `<project>_` prefix of the filename, available via `projectOf` from
  `lib/entries/path.js`) so the user can disambiguate by ownership.

## Invariants

- **Resolve the root before searching, every time.** Never grep the cwd; never
  use a default path. If the root is unset, STOP and point at
  `/archievement:setup`.
- **`find` is read-only.** It never writes to disk.
- **`reports/` is excluded** from content search — only entry documents under
  `work/` and `personal/`.
- **Recall is language-agnostic** (query keywords may be Chinese), but the
  skill's own artifacts stay English per convention.
