---
title: archievement — Personal Work Memory Archiver Claude Code Plugin
status: draft (pending user review)
date: 2026-05-23
authors: [irene.yu, claude]
---

# archievement — Design Spec

A personal "work memory archiver" Claude Code plugin. It distills valuable
session content (brainstorms, plans, tasks, PR summaries, progress notes,
learning logs, raw ideas) into a structured local markdown tree, then synthesizes
progress reports and personal performance review drafts on demand.

## 1. Architecture overview

### Mental model

> **archievement is a sink, not a source.** It does not know what JIRA / GitHub /
> Slack are, holds no external auth or state, and only ingests content that
> already exists in the session context. How that context got there
> (you typed it, hodor fetched a JIRA, another MCP supplied a PR, you pasted
> perf review criteria) is not its concern.

### Three layers

1. **Data layer** — `archievement/` is a user-chosen visible directory
   (suggested `~/archievement/`). Plain markdown plus YAML frontmatter, no
   database, no external service, no token. Uninstalling the plugin leaves all
   data as ordinary files that any editor, `grep`, Obsidian, or a future
   LLM-Wiki can pick up. The user picks the path during `/archievement:setup`
   and it is stored in `${CLAUDE_PLUGIN_DATA}/config.yml` — no silent default
   exists in code.

2. **Skill layer** — A small set of focused skills. Each is invocable by the
   user via `/<verb>` and is also callable by Claude during a conversation.
   **Every skill confirms scope / type / content with the user via
   `AskUserQuestion` before writing to disk; it never guesses.** Skills
   communicate through the filesystem only; there is no implicit shared state.

3. **Hook layer** — A handful of `PostToolUse` / `SessionStart` hooks that
   issue **soft nudges** at natural boundaries (entering a tracked project,
   `gh pr create` completing, session start). Hooks only inject information
   into context; they never write to disk and never force Claude to act.

### Key invariants

- **`AskUserQuestion` always precedes any write**, even when a natural anchor
  is present.
- **The plugin never calls any external API** (JIRA / GitHub / Slack / etc.).
- **No fallbacks, no guessed defaults** — if information is missing, ask;
  never proceed on assumption.
- **The `archievement/` directory may be independently git-managed**, but the
  plugin itself does not enforce, initiate, or perform any git operation.
  The user commits manually if they choose.

---

## 2. Data model

### Taxonomy — two orthogonal axes

- **Category (sphere)**: `work` | `personal` — identity domain.
- **Type (form)**: `ticketed` | `unticketed` | `learning` | `idea` —
  entry shape.

All eight combinations are meaningful and symmetric:
`work × ticketed` (a company JIRA task), `work × learning` (learning a
framework the team will adopt), `personal × ticketed` (a side project with an
issue tracker), `personal × idea` (a personal spark of inspiration), and so
on. **The term "side-project" never appears inside the plugin** — it is
simply `personal × ticketed` or `personal × unticketed`.

### Directory layout

```
archievement/
  config/
    global.yml                              # default language, stale threshold, etc.
    projects.yml                            # cwd → category + slug + language map
    user-prefs.yml                          # languages_known and other lightweight memory
  work/
    ticketed/
      PROJ-123/                             # layout: dir
        index.md                            # frontmatter + top-level overview
        brainstorm.md
        plan.md
        tasks.md
        progress.md                         # chronological log, single file appended
        pr-summaries/
          2026-05-15-pr-456.md
          2026-05-20-pr-461.md
      QUICK-789.md                          # layout: file (lightweight, can be expanded later)
    unticketed/
      ci-perf-tooling-research/
        index.md
        brainstorm.md
        ...
    learning/
      rust-for-team-migration/
        index.md
        plan.md
        materials/
        progress.md
    idea/
      perf-review-auto-tag.md
  personal/
    ticketed/                               # side project with issue tracker
      MYAPP-1/
        ...
    unticketed/
      archievement/                         # the plugin itself is personal × unticketed
        ...
    learning/
      rust-async/
        ...
    idea/
      streaming-md-parser.md
  reports/
    2026-05-23-summary.md
    2026-05-23-completion.md
    2026-05-23-prediction.md
    perf-review/
      2026-05-23-h1-2026-work.md
```

### Frontmatter schema

**Common fields** (every entry):

```yaml
category: work | personal
type: ticketed | unticketed | learning | idea
status: todo | in-progress | done
created: 2026-05-01
updated: 2026-05-23
layout: dir | file
tags: [auth, refactor]                      # optional
```

**Type-specific fields:**

```yaml
# ticketed
ticket_id: PROJ-123                         # opaque string, not bound to any vendor
project: project-a                         # resolved from projects.yml
prs:                                        # auto-appended as pr-summaries are added
  - { id: 456, title: "...", date: 2026-05-15 }

# unticketed
project: project-a                         # optional; null when ad-hoc
topic: "tooling research for X"

# learning
topic: rust-async

# idea
seed_date: 2026-05-23
promoted_to: work/ticketed/PROJ-123         # written when promotion occurs
promoted_from: work/idea/foo.md            # back-link on the promoted entry
```

**Dual source of truth**: `category` and `type` live both in the frontmatter
and in the directory path. The frontmatter is canonical; the path is a
browsing convenience. This way, an entry moved to a wrong directory does not
lose its identity, and `arch-promote` operations stay robust.

**Frontmatter is always English** (keys and enum values). Frontmatter is
schema, not content; mixing languages there would make parsing brittle. Body
prose follows the language preference (see §3.4).

### `projects.yml`

```yaml
projects:
  - match: { type: git-remote, url: "https://github.com/myorg/project-a.git" }
    slug: project-a
    category: work
    language: en                            # optional, defaults to global default
  - match: { type: git-remote, url: "https://github.com/AgenticFish/archievement.git" }
    slug: archievement
    category: personal
    language: zh
  - match: { type: path, path: "/some/local/dir/without/git" }
    slug: foo
    category: personal

ignore:                                     # "do not track" choices land here
  - match: { type: path, path: "/path/to/some/ignored/dir" }
```

**Matching rule**: prefer `git remote get-url origin`; fall back to absolute
path when no git remote exists. Reason: the same project may exist in
multiple local checkouts (for parallel Claude sessions). Matching by git
remote points every checkout at the same archievement record.

### `global.yml`

```yaml
default_language: zh                        # ISO 639-1 code; any language Claude writes
stale_days: 21                              # threshold for the ⚠️ stale marker in summary
```

The archievement root path itself lives in `${CLAUDE_PLUGIN_DATA}/config.yml`
(Claude Code-managed plugin user-data dir), not inside the root's own
`global.yml`. Keeping the pointer outside the data dir means the resolver can
find the root before reading any file inside it.

### Plugin user-data config (`${CLAUDE_PLUGIN_DATA}/config.yml`)

```yaml
archievement_root: /Users/jane/archievement   # written by /archievement:setup
```

`CLAUDE_PLUGIN_DATA` is the env var Claude Code (>= 2.1.78) injects into
plugin subprocesses; the platform auto-creates `~/.claude/plugins/data/<plugin-id>/`
and preserves it across plugin updates. This is the authoritative source of
truth for `archievement_root`; no code path uses a default value.

### `user-prefs.yml` (lightweight self-memory)

```yaml
languages_known: [zh, en]                   # languages the user has used; powers dynamic AskUserQuestion options
```

### Promotion operation

Two axes, handled by a single `arch-promote` skill:

1. **Form promotion** (common): `idea` → `ticketed` / `unticketed`, or
   `unticketed` → `ticketed`.
2. **Cross-category promotion** (rarer): e.g. `personal/idea/foo.md` →
   `work/ticketed/PROJ-123/` when the company picks up a personal idea.

Promotion flow:

1. `AskUserQuestion` to confirm target type / category / `ticket_id` or slug.
2. Physically move the file or directory to the new location.
3. If the source is `layout: file` but the target needs `dir`, **auto-expand**:
   move the original body into the new `index.md`; optionally split sections
   into `brainstorm.md`, `plan.md`, etc.
4. Write reciprocal links: the new entry gets `promoted_from`, the original
   gets `promoted_to`.
5. The original entry **stays in place** (no move to a separate archive
   directory) and its `status` is set to `done`. The `promoted_to` field
   marks it as "completed by becoming something else." This is what causes
   promotions to surface in the completion report (see §5.3).
6. The original is **never deleted** (audit trail). If the user wants it gone,
   they `rm` it themselves.

---

## 3. Interaction model

### 3.1 Skills

| Skill | When | Responsibility |
|---|---|---|
| `arch-setup` | One-time, after install | Asks where `archievement/` lives and the default language; creates the directory skeleton and empty config files |
| `arch-record` | The workhorse — distilling session content | Captures, dispatches to the right entry (creating one if needed), confirms scope, writes the file |
| `arch-report` | Reviewing progress / writing a monthly self-tracking report / generating perf review draft | Read-only aggregation; writes to `reports/<date>-<kind>.md` |
| `arch-promote` | Promoting `idea` / `unticketed`, or expanding `file` → `dir` | Same-category or cross-category move; writes reciprocal links |
| `arch-status` *(optional)* | Quickly changing status | May fold into `arch-record` |

Skills communicate through the filesystem and hold no shared in-memory state.
`arch-record` invokes `arch-promote` (via the `Skill` tool) when it detects a
promotion intent.

### 3.2 Hooks

| Hook | Trigger | Behavior |
|---|---|---|
| `SessionStart` | Claude Code session begins | 1. Resolve cwd → git remote → look up `projects.yml`<br>2. On hit: inject `active entries` for that project — defined as entries whose `status` is `todo` or `in-progress` (i.e., not `done`). Example: `active entries: PROJ-123 (in-progress), QUICK-789 (todo)`<br>3. On miss (and not in ignore list): inject `unregistered project — if any arch-* skill is invoked, ask the user to register first` |
| `PostToolUse` on `gh pr create` | After a PR is created | Parse output to extract PR number / title / URL; inject `PR #456 created — invoke /arch-record to save its summary` |

**All hooks are soft** — they inject context only; they never write data and
never force Claude to act. Every write goes through a skill plus
`AskUserQuestion`.

### 3.3 Common `AskUserQuestion` templates

For UX consistency, these prompts share the same wording and options across
all skills:

- **Dispatch — category**: `work / personal`
- **Dispatch — type**: `ticketed / unticketed / learning / idea`
- **Layout**: `dir (complex, expandable) / file (single file, expandable later)`
- **Scope (mandatory before any write)**: `entire session / last N turns / I'll specify the range / I'll tell you the content directly`
- **Doc kind**: `brainstorm / plan / tasks / pr-summary / progress / new section`
- **Existing entry pick**: list of active entries plus a `new entry` option

### 3.4 Language preference resolution

When writing, a skill resolves the output language in this order:

1. **Explicit session instruction** ("write this one in English").
2. **The entry's project `language` field** (when the entry has a `project`
   and `projects.yml` specifies a language for it).
3. **`global.yml`'s `default_language`**.

This applies to all body prose. **Frontmatter keys and enum values remain
English unconditionally.**

### 3.5 Language prompt — dynamic options

Before invoking `AskUserQuestion` about language, Claude builds options based
on observed signals:

1. The language the user has been writing in this session (strongest signal).
2. The `languages_known` list in `config/user-prefs.yml` (the fast path on
   second and later runs).
3. If neither is clear, fall back to "English / Other (user enters)".

**English is always an option.** Example: a Chinese-speaking user sees
`中文 / English`; a French-speaking user sees `Français / English`.

After the first setup, the selected language is written to `user-prefs.yml`.
Subsequent project registrations reuse the cached list rather than re-detecting,
which avoids choice drift when the user occasionally types in another language.

### 3.6 One deliberate non-automation

The `status` field is **always changed manually**, never inferred from
context. Inference would be right 90% of the time and silently wrong 10% of
the time — and once data starts drifting, trust is gone. Status changes
happen via `/arch-status`, or as a final "want to update status?" question at
the end of `/arch-record`.

### 3.7 Worked example

> You just discussed brainstorming for PROJ-123 with Claude. You type
> `/arch-record`.
>
> 1. The SessionStart hook already injected `PROJ-123 active`, so the skill
>    knows of the candidate entry.
> 2. `AskUserQuestion`: "Record into PROJ-123 or create a new entry?" → PROJ-123.
> 3. `AskUserQuestion`: "Doc kind?" → brainstorm.
> 4. `AskUserQuestion`: "Scope?" → last N turns.
> 5. The skill drafts the section, shows it, asks `AskUserQuestion`:
>    "Save this / let me edit / cancel" → save.
> 6. It appends a `## 2026-05-23` section to
>    `archievement/work/ticketed/PROJ-123/brainstorm.md`.
> 7. It updates `index.md`'s `updated` field in the frontmatter.

---

## 4. Capability mapping (the original 8 requirements → 5 capabilities + 1 dispatcher)

| Original requirement | Realization in the new model |
|---|---|
| 0. Project root → category mapping | `arch-setup` + `SessionStart` hook + `projects.yml` |
| **1+2+3. Ticketed / unticketed records for work and personal projects** | **One unified path**: `arch-record`. Category comes from cwd; type comes from whether `ticket_id` is present. The two categories are fully symmetric across every type. |
| 4. Learning | `arch-record` with `type=learning` (category from cwd or AskUserQuestion) |
| 5. Ideas | `arch-record` with `type=idea` (no cwd binding; AskUserQuestion sets category) |
| 6. Summary / prediction / completion reports | `arch-report` with `kind=...`; optional category filter (default both) |
| 7. Performance review | `arch-report` with `kind=perf-review` + **mandatory category filter** |

### 4.1 A multi-day, multi-PR ticketed work journey

```
Day 1   /arch-record   → ticket_id=PROJ-123 (new) → doc=brainstorm → layout=dir
                       → writes work/ticketed/PROJ-123/brainstorm.md
Day 1   /arch-record   → same PROJ-123 → doc=plan
                       → writes .../plan.md
Day 3   /arch-record   → doc=progress (append) → status: in-progress
                       → appends to .../progress.md
Day 5   gh pr create   → PostToolUse hook prompts "save PR summary?"
        /arch-record   → doc=pr-summary → writes .../pr-summaries/2026-05-05-pr-456.md
                       → auto-appends to index.md's prs[] list
Day 10  /arch-record   → doc=progress, "merged, waiting on next phase"
Day 14  /arch-record   → doc=pr-summary (PR 2) → writes .../pr-summaries/2026-05-14-pr-461.md
Day 14  /arch-status   → in-progress → done
```

### 4.2 Idea → ticketed promotion path

```
Day 0   /arch-record   → type=idea → category=work → slug perf-review-auto-tag
                       → writes work/idea/perf-review-auto-tag.md
Day 30  /arch-promote  → target type=unticketed → category=work
                       → moves to work/unticketed/perf-review-tagging-poc/
                       → expands file → dir (body into index.md + brainstorm.md)
                       → old idea gets promoted_to, new entry gets promoted_from
Day 60  /arch-promote  → company opened a JIRA → target type=ticketed → ticket_id=PROJ-999
                       → moves to work/ticketed/PROJ-999/
                       → audit trail chains: idea → unticketed → ticketed
```

---

## 5. Report output formats

### 5.1 Common shape

Every report is markdown + frontmatter, written to
`archievement/reports/<date>-<kind>.md` (perf review uses an extra
subdirectory). The frontmatter:

```yaml
---
type: report
kind: summary | prediction | completion | perf-review
generated: 2026-05-23
range: snapshot | 2026-04-23..2026-05-23
language: zh
category_filter: work | personal | both | null
---
```

### 5.2 Summary (snapshot)

Scans every entry with `status: in-progress` and groups by `category × type`.
Entries that haven't been updated within `stale_days` (default 21, configurable
in `global.yml`) get a `⚠️ stale` marker.

```markdown
# Summary (2026-05-23)

## Work
### Ticketed (3)
- **PROJ-123** — Migrate auth middleware — 1d ago
- **PROJ-456** — Add billing webhook — 25d ago ⚠️ stale
- **QUICK-789** — Bump deps — 3d ago

### Learning (1)
- **rust-for-team-migration** — 4d ago

## Personal
### Unticketed (1)
- **archievement** — today
```

### 5.3 Completion (time range)

Lists entries that transitioned to `done` within the range plus short summaries.
**Promotion counts as a completion** — when an `idea` or `unticketed` is
promoted to the next form, the promotion itself is a "thing finished" and shows
up in the completion report, even if the new entry is still in-progress.

```markdown
# Completed in the last 30 days (2026-04-23..2026-05-23)

## Work
### Ticketed (2)
- **PROJ-100** — Fixed N+1 in user list — done 2026-04-29 — 3 PRs
- **PROJ-105** — Added CSP headers — done 2026-05-12 — 1 PR

### Learning (1)
- **rust-for-team-migration** — done 2026-05-19

## Personal
### Promoted from idea (1)
- `streaming-md-parser` → `personal/unticketed/streaming-md-poc` on 2026-05-08
```

### 5.4 Prediction (idea-advancement suggestions)

The LLM reads the idea bodies and finds semantic links to recent in-progress,
done, or learning entries.

```markdown
# Prediction (2026-05-23)

## Ideas worth promoting

- **`work/idea/perf-review-auto-tag.md`** (seeded 2026-04-12)
  - Connection: PROJ-123 (auth middleware) touches the same competency taxonomy.
  - Connection: just completed `learning/rust-for-team-migration` — Rust syntax is now fluent.
  - Suggested: promote to `work × unticketed`, slug `perf-review-tagging-poc`.

## Ideas with no clear path yet

- **`personal/idea/streaming-md-parser.md`** — no recent activity ties to it.
```

**Design call**: prediction **does not** apply category isolation. This report
is for the user alone, and cross-category links are valuable (a personal
learning may seed a work idea). Prediction output is never auto-fed into a
perf review, so the structural isolation guarantee in §5.6 still holds.

### 5.5 Perf review (most complex, mandatory category filter)

**Two modes:**

- **Template mode** — the user pasted a company template into the session.
  The skill uses the template's sections as the skeleton and fills each
  section from matching entries, preserving the template's section titles,
  length hints, and wording requirements.
- **Free-form mode** — no template provided; the skill uses the recommended
  structure below.

**Recommended structure (free-form):**

```markdown
# Performance review draft — H1 2026 — work

## Major deliverables
[done ticketed entries, ordered by impact / time; for each:
 title + completion date + key contribution + PR count + references to
 archievement internal docs for easy lookup]

## Investigations & tooling
[done + in-progress unticketed entries]

## Learning & growth
[done + in-progress learning entries]

## Anchors (numbers)
- Total tickets closed: 8
- PRs merged: 14
- Avg days in-progress → done: 6.3
```

**Anchors are computed deterministically by plugin code (Python / shell /
Node — not the LLM).** Letting an LLM estimate numbers invites drift. The
skill runs a stats script, takes its output as ground truth, and writes that
into the report.

**A disclaimer is appended automatically:**

> _Draft generated by archievement on 2026-05-23 from your archievement entries
> (work, 2025-11-01 to 2026-04-30). This is a starting point — review, edit,
> and adapt before submitting._

### 5.6 Perf review hard isolation (core safety property)

Mixing the other category into a perf review is a real accident risk (e.g.
mentioning personal side projects in a work review). We do not rely on the
LLM to "remember to filter."

**Structural isolation:**

1. `AskUserQuestion`: "Category for this perf review?" with options
   `work / personal`. **No `both` option** — a perf review is single-audience
   by definition.
2. **At the data-loading stage (before the LLM sees anything)**: the skill
   only globs `archievement/<category>/**` and **does not load** any file
   from the other category. Those entries are physically absent from context.
3. **Frontmatter validation**: every loaded entry is checked to make sure its
   `category` field matches the requested filter. This catches files that
   were misplaced into the wrong directory.
4. The report-generation prompt restates "you are writing a `<category>` perf
   review, only use the data provided."

Steps 1+2 are a **structural guarantee** (the LLM cannot mix what it cannot
see); 3+4 are belt-and-suspenders. The other reports
(summary / prediction / completion) accept an optional category filter and
default to `both`, because they are private trackers with no accident risk.

---

## 6. Out of scope

- **No external integrations** — no calls to any API (JIRA / GitHub / Linear /
  Slack / corporate perf review systems); no tokens / OAuth / API keys.
  External information enters via the user or via other MCPs / plugins.
- **No git operations** — the plugin never auto-commits `archievement/` and
  never pushes to a remote. The user commits manually (or sets up their own
  cron / hook).
- **No concurrency safety** — the same entry must not be edited from two
  sessions simultaneously; the user manages this themselves. No file locks,
  no CRDT, no conflict resolution.
- **No automatic status changes** — `status` is always set by the user, even
  after a PR summary is saved or a `done`-labeled PR merges.
- **No reminders or notifications** — the plugin is reactive. For "weekly
  auto-summary," the user wires up Claude Code's `ScheduleWakeup` or system
  cron to call `/arch-report`.
- **No UI** — no web UI, TUI, or Electron app. All interaction is through
  the Claude Code session.
- **No multilingual UI string table** — `AskUserQuestion` prompts and options
  are generated by Claude at runtime based on the session language. The
  plugin's code does not ship an i18n dictionary.
- **No migration tools** — no importers from Obsidian / Notion / Bear /
  Logseq in v1.
- **No encryption** — `archievement/` is plain markdown. Users who need
  encryption use filesystem-level tools (FileVault, an encrypted volume,
  etc.).
- **No delete skill** — to remove an entry, the user runs `rm`. The plugin
  is append-mostly; explicit deletion is an escape hatch, not a first-class
  flow.
- **No cross-user / team features** — strictly personal; no share, publish,
  or export-to-team operations.

---

## 7. Open questions (deferred to writing-plans)

- **MVP scope / phasing** — Build all five capabilities at once, or stage as
  v1 = setup + record, v2 = report, v3 = perf review?
- **`arch-status` standalone vs. folded into `arch-record`** — depends on UX
  testing with the first real use.
- **Plugin implementation language** — skill files are markdown plus
  frontmatter; the helper scripts can be shell, Python, or Node. Choice
  depends on the Claude Code plugin packaging conventions and on what runs
  cleanly across macOS / Linux (where the user works).
- **Stats computation runtime** — what executes the deterministic
  Anchors numbers (`jq`, a Python script, a Node script, shell + awk)?
- **`projects.yml` git-remote normalization** — should
  `git@github.com:foo/bar.git` and `https://github.com/foo/bar.git` be
  treated as the same remote? (Suggested: yes.)
- **First-time SessionStart hook timing** — the locked-in design is B
  (auto-prompt for unknown projects), but the prompt could fire either
  immediately on session start or be deferred until the user calls the first
  `arch-*` skill. The former is more proactive; the latter is less intrusive.
- **Report history view** — if `arch-report` is called twice on the same day,
  the second run would overwrite `reports/2026-05-23-summary.md`. Add a
  timestamp suffix, or always keep only the latest? Pick one.
