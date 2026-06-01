---
title: project-setup skill — Project Metadata Management
status: draft (pending user review)
date: 2026-06-01
authors: [irene.yu, claude]
---

# project-setup skill — Design Spec

A 5th user-facing archievement skill that manages project registrations and the
ignore list, closing a gap left by the shipped plugin: there is currently **no
entry point** for viewing, registering, modifying, or ignoring a project's
config — `${CLAUDE_PLUGIN_DATA}/config.yml` can only be hand-edited.

## 1. Background and motivation

The `record` skill auto-registers nothing — despite the original plan's §35
smoke checklist describing a "record prompts you to register the project" flow,
that flow does not exist anywhere in the shipped plugin (`record/SKILL.md` only
asks the new entry's category; it never writes to the `projects` list). During
first-time setup the user had to manually call `addProject` to register the
current project.

Three recurring needs have no home today:

- **View** what is registered in the `projects` / `ignore` lists.
- **Register / modify** a project's slug, category, or language.
- **Ignore** a working directory so the SessionStart hook stops nudging in it.

`project-setup` provides that home.

> This skill stays true to the plugin's **sink-not-source** rule: it only reads
> and writes the local unified config. It calls no external API.

## 2. Naming

The skill is named **`project-setup`**, invoked as `/archievement:project-setup`.

It is distinct from the existing **`setup`** skill: `setup` is the one-time
**global** initialization (root path, default language, directory skeleton).
`project-setup` is the recurring **per-project** registration/config tool. The
SKILL.md description and body must state this distinction explicitly so the two
are not confused.

## 3. Operation model

The skill is **cwd-centric**. On invocation it probes the current working
directory and presents a three-item menu. Every operation acts on the current
cwd (with the sole read-only exception of `show`, which lists everything).

### 3.1 Probe and state

1. **Guard:** call `resolveArchievementRoot()`. If null, stop and instruct the
   user to run `/archievement:setup` first (consistent with every other skill).
2. **Probe:** `getProjectProbe(cwd)` from `lib/git.js` → `{ remote, cwd }`.
3. **Classify:** `matchProject(config, probe)` → `match` | `ignored` | `unknown`.

The classified state drives the dynamic labels in the menu so the user sees, at
a glance, whether the current directory is registered, ignored, or unknown.

### 3.2 The three-item menu

Top-level `AskUserQuestion` with options `show` / `configure` / `ignore`.

| Menu item | Behavior (all scoped to current cwd unless noted) |
|---|---|
| **show** | Read-only. List all registered projects and the ignore list; highlight the entry that matches the current cwd. |
| **configure** | Smart upsert. If cwd is `unknown` → **register**. If cwd is already a `match` → **modify**, with a "remove this registration" sub-option. |
| **ignore** | Toggle. If cwd is not ignored → `addIgnore`. If cwd is already ignored → `removeIgnore`. |

### 3.3 configure — register branch (cwd is `unknown`)

Ask, via `AskUserQuestion`, in order:

1. **slug** — short identifier. If the slug already exists on another project,
   warn but allow (slugs are not enforced unique).
2. **category** — `work` | `personal`.
3. **language** — options built dynamically from `loadConfig().languages_known`
   plus English, mirroring the `setup` skill.

Then `addProject(config, entry)` and `saveConfig`. The matcher is chosen by the
probe: **`git-remote`** matcher when `probe.remote` is non-null (robust across
clones and path moves), otherwise a **`path`** matcher on `probe.cwd`. This
matches how the SessionStart hook itself probes.

### 3.4 configure — modify branch (cwd is a `match`)

Show the current slug / category / language. `AskUserQuestion` to pick which
field(s) to change, collect new values, then `updateProject(config, slug,
patch)`. The same question set offers a **"remove this registration"**
sub-option → `removeProject(config, slug)`.

### 3.5 ignore — toggle branch

- cwd not currently ignored → `addIgnore(config, { match })` using the same
  matcher-selection rule as register.
- cwd already ignored → `removeIgnore(config, matcher)`.

## 4. lib changes

Three new **pure** transforms in `lib/config/plugin.js`, returning new config
objects (matching the existing `addProject` / `addIgnore` / `rememberLanguage`
immutable style):

```js
/** Merge `patch` into the project whose slug matches; no match → config unchanged. */
updateProject(config, slug, patch)

/** Return config with the slug-matching project filtered out. */
removeProject(config, slug)

/** Return config with the matcher-matching ignore entry filtered out. */
removeIgnore(config, matcher)
```

Design decisions:

- **No-op on missing target.** `updateProject` / `removeProject` /
  `removeIgnore` return the config unchanged when nothing matches, rather than
  throwing. The skill only calls them after confirming a match, so this keeps
  the helpers total and side-effect-free.
- **Matcher equality** for `removeIgnore` reuses the same field comparison
  semantics as `matcherMatches` (git-remote URL equality / path equality).
- `getProjectProbe` is reused unchanged from `lib/git.js`.

No new module is created; the helpers join the existing config module. No
existing exported function changes signature.

## 5. Cross-cutting changes

### 5.1 SessionStart nudge (approved change to §7 output)

`lib/hooks/session-start.js`'s `unknown` branch currently emits the generic line
"If any archievement skill is invoked, prompt the user to register or ignore
this project." This is updated to name the skill explicitly:

> run `/archievement:project-setup` to register or ignore this project.

This is the only change to a prior section's shipped output and was explicitly
approved during brainstorming.

### 5.2 Documentation

- **README** — add `project-setup` to the skills list/usage.
- **CLAUDE.md** — skills count 4 → 5; repo layout note; an Execution-status row
  for this follow-up work.
- **This spec** — committed under `docs/superpowers/specs/`.

## 6. Error handling

| Situation | Behavior |
|---|---|
| `archievement_root` is null | Stop; instruct user to run `/archievement:setup`. |
| cwd has no git remote | `path` matcher is used; cwd always exists, so register/ignore always work. |
| `updateProject`/`removeProject`/`removeIgnore` target not found | Return config unchanged (no throw). |
| slug collides with an existing project on register | Warn, allow (slugs not unique). |

## 7. Testing

- **TDD** for the three pure helpers in `test/config/plugin.test.js`
  (`updateProject` merges/leaves-untouched, `removeProject` filters/no-ops,
  `removeIgnore` filters by matcher equality).
- The shared `test/skills.test.js` frontmatter sanity test automatically covers
  the new `skills/project-setup/SKILL.md` (name/description frontmatter), so no
  bespoke skill test is required.

## 8. Scope summary

3 pure helpers + tests, 1 SKILL.md, 1 SessionStart line, docs. A medium PR,
smaller than §3 (Entries). Shipped as a single follow-up PR with an imperative
PR title (e.g. `Add project-setup skill for project-metadata management`).

## 9. Out of scope (YAGNI)

- Editing or removing a project that is **not** the current cwd (no target
  picker — `cd` there first).
- Registering a non-current directory.
- Backfilling or migrating existing registrations.
- Any change to the `record` skill's flow (the SessionStart nudge is the only
  pointer added).
