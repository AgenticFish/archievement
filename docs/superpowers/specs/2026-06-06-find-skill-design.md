---
title: archievement find skill — Locate & Recall Archieved Content
status: draft (pending user review)
date: 2026-06-06
authors: [irene.yu, claude]
---

# archievement `find` skill — Design Spec

A sixth skill for the archievement plugin: **locate or recall something
previously archieved**. When the user says "find the archievement file about
X" or "the idea we archieved about Y", this skill reliably (1) resolves the
archievement root, then (2) recalls within it by filename/slug, by full-text
content, or by frontmatter filters.

## 1. Motivation

The archievement plugin stores content under a user-chosen **root**
(e.g. `~/archievement/`), which is a *different place* from whatever repo the
user happens to be working in. A real failure mode (observed 2026-06-06): the
user named an archieved file, and the assistant grepped the **current working
directory** — the plugin's own source repo — instead of resolving the root and
searching there. The file was never in the cwd; it lived under the configured
root. The two directories can even share a name (`archievement`), which makes
the trap easy to fall into.

The root cause has two layers, and this spec addresses both:

1. **No institutionalized recall flow.** There was no skill whose job is
   "resolve root first, then search within it". Ad-hoc `grep` in the cwd is the
   path of least resistance and it is wrong.
2. **Root path absent from session context.** The `SessionStart` hook injects
   project / category / active entries, but **not** the root path — so the
   assistant had nothing in context pointing at where to look.

This is also why the env-var workaround matters: `CLAUDE_PLUGIN_DATA` is **not**
injected into plain Bash subprocesses (it is empty there), but Claude Code
*does* template-substitute `${CLAUDE_PLUGIN_DATA}` at SKILL.md load time. A
skill therefore resolves the root reliably where an ad-hoc Bash command cannot.

## 2. Goals & non-goals

### Goals

- A `find` skill that triggers on natural recall phrasings (English and the
  user's mixed Chinese/English, e.g. "我们之前 archievement 了一个关于 X 的 idea").
- Three recall modes: **by filename/slug**, **by full-text content**, **by
  frontmatter filters** (category / type / status / project).
- Robust against fuzzy, natural-language queries — the LLM extracts retrieval
  signals from prose; recall uses native tools; the LLM ranks semantically.
- **Always** resolve the root first; **never** grep the cwd or guess a path.
- A small `SessionStart` hook change so the root path is in context from the
  start of every session (defense-in-depth; the skill does not depend on it).

### Non-goals

- **No new `lib/` code.** Recall reuses native `Grep`/`Glob` and the existing
  `listEntries(root, filters)`.
- **No semantic search index / embeddings.** Recall = native lexical search;
  ranking = the LLM reading candidates. No vector store.
- **`reports/` is out of scope for content search.** Only entry documents are
  searched (see §4).
- **No write operations.** `find` is read-only. (Promotion / editing remain in
  `promote` / `record`.)

## 3. Architecture

Three thin change surfaces. No new `lib/` modules.

1. **New skill `skills/find/SKILL.md`** — the only new artifact. Pure prose; it
   orchestrates native tools, it does not add JavaScript logic.
2. **Modified `lib/hooks/session-start.js`** — inject `archievement root:
   <path>` into `<archievement-context>` for the `match` and `unknown`
   branches (only when a root is configured). The `ignored` branch stays
   silent.
3. **Docs + tests** — update the skill inventory (5 → 6) in `CLAUDE.md` and
   `README.md`; extend the `runSessionStart` tests for the new root line.

### Why no new lib

Recall has two halves: **retrieval (recall)** and **semantic ranking**. Ranking
can only be done by the LLM — Node cannot know that "科普文的 idea" maps to
`type: idea`. The retrieval half is best served by the assistant's native
`Grep` (ripgrep: fast, regex, context lines, Unicode/Chinese-capable) and
`Glob`, plus the existing `listEntries` for frontmatter. There is no
deterministic logic left that would justify re-implementing grep inside Node
(which would be a strictly weaker grep). This is the deliberate trade-off of
this design: recall logic lives in skill prose, guarded by the skill
`description`, an explicit red-line rule, and human review — not by unit tests.

## 4. The `find` flow

The skill body specifies the following procedure.

### 4.1 Resolve root (always first)

Run the same node one-liner the `record` / `report` skills use, where
`${CLAUDE_PLUGIN_DATA}` is template-substituted at load time:

```
node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ resolveArchievementRoot }) => process.stdout.write(resolveArchievementRoot({ pluginConfigPath: '${CLAUDE_PLUGIN_DATA}/config.yml' }) ?? ''))"
```

If the output is empty: **STOP.** Tell the user "archievement is not set up. Run
`/archievement:setup` first, then re-invoke this skill." Do **not** search the
filesystem, do **not** use a default path.

(If a `<archievement-context>` block already carries an `archievement root:`
line from the SessionStart hook, the skill may use it directly — but it still
falls back to the node one-liner, never to a guess.)

### 4.2 Extract retrieval signals (LLM)

The skill instructs the assistant to decompose the natural-language query into:

- **Filename/slug keywords** — prefer English tokens that land in file names
  (e.g. `mcp`, `transport`).
- **Frontmatter hints** — map prose to filters: "idea / 想法 / 科普文的想法" →
  `type: idea`; "做完的 / done" → `status: done`; "work / personal" → category;
  a known project name → `project`.
- **Body keywords** — including Chinese (e.g. "科普", "transport").

### 4.3 Recall (native tools; `work/` + `personal/` only)

Search only `<root>/work` and `<root>/personal`, so `reports/` is never
touched.

- **Filename:** `Glob` with `**/*<kw>*.md` under the two category dirs.
- **Content:** `Grep` with `<kw1>|<kw2>|…`, case-insensitive, with context
  lines, `path` set to the two category dirs. Searches **all entry documents**:
  file-layout `.md` bodies, dir-layout `index.md`, and dir-layout sibling docs
  (`brainstorm.md`, `plan.md`, `tasks.md`, `pr-summaries/*.md`).
- **Frontmatter:** `listEntries(root, { category?, type?, status?, project? })`
  via a node one-liner.

Merge and de-duplicate into a candidate set. A sibling-doc hit (e.g.
`personal/idea/foo/brainstorm.md`) is mapped back to its owning entry `foo`.

### 4.4 Rank (LLM)

Order candidates by signal strength: filename match > exact frontmatter match >
body match; multiple overlapping signals score higher. This is the assistant's
judgment, not a computed score.

### 4.5 Output

- **Single hit** → `Read` it directly and present it, so the conversation can
  continue seamlessly (no extra prompt).
- **Multiple hits** → list `path` + title + matching snippet, then
  `AskUserQuestion` "Which one do you want to open?".
- **Zero hits** → report "nothing matched under the root", show the few closest
  candidates, and suggest broadening the terms.

## 5. SessionStart hook change

`lib/hooks/session-start.js` currently has three branches (`:37-66`):

| Branch | Current output | New output |
| --- | --- | --- |
| `ignored` | `""` (silent) | **unchanged** — stays silent (respects "ignored = zero noise") |
| `unknown` | "unregistered project…" nudge, **no root** | same nudge **plus** an `archievement root: <root>` line |
| `match` | project / category / language / active entries, **no root** | same, **plus** an `archievement root: <root>` line at the top |

The root line is added **only when `config.archievement_root` is non-null** (the
existing early-return for a null root is unchanged). The `ignored` branch is
deliberately left silent: defense-in-depth means the hook injection is "nice to
have", while the `find` skill always resolves the root itself (§4.1) and works
even in a project the user explicitly chose to ignore.

## 6. Triggering (the skill `description`)

Reliable auto-triggering is what root-causes the original bug. Draft
`description` (English, per the artifact-language convention):

> Use when the user wants to locate or recall something previously archieved —
> find an entry by filename/slug, by topic/keyword, or by frontmatter
> (category/type/status/project). Resolves the archievement root first (never
> searches the cwd or guesses a path), then recalls within it. Triggers on
> phrasings like "find the archievement file about X", "the idea/note we
> archieved about Y", "did we archieve anything on Z".

The skill body also carries a **red-line rule** (echoing the
`feedback_archievement_root_lookup` learning):

> Never grep the cwd or the plugin source repo for archievement content. Always
> `resolveArchievementRoot()` first and search inside the returned root. These
> are different places and their names can collide.

## 7. Testing & docs

- **Hook logic tests** — `runSessionStart` already accepts injectable I/O.
  Add cases: with a configured root, `match` and `unknown` outputs contain the
  `archievement root:` line; the `ignored` branch still returns `""`; with a
  null root, behavior is unchanged (early return).
- **Skill frontmatter sanity** — `test/skills.test.js` auto-validates every
  skill's frontmatter; `find` inherits this coverage with no extra test.
- **No `node:test` for the skill itself** — it is prose + native tools with no
  unit-testable JS. This is the §3 trade-off, made explicit.
- **Docs** — bump the skill inventory (5 → 6) and the §9-style status table in
  `CLAUDE.md`; sync the skill list in `README.md`.

## 8. Invariants

- **Resolve root before searching, every time.** Never grep the cwd; never use
  a default path; if the root is unset, STOP and point at `/archievement:setup`.
- **`find` is read-only.** It never writes to disk.
- **`reports/` is excluded** from content search — only entry documents.
- **The skill always resolves root itself**, independent of the hook injection
  (the hook line is an optimization, not a dependency).
- **Frontmatter is English; recall is language-agnostic** — query keywords may
  be Chinese, but the skill's own artifacts stay English per convention.
