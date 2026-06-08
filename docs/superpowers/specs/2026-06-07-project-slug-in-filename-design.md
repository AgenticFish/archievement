---
title: Project slug in entry filenames — `<project>_<slug>` id encoding
status: implemented (2026-06-08)
date: 2026-06-07
authors: [irene.yu, claude]
---

# Project slug in entry filenames — Design Spec

Encode the owning project into every entry's `id` (and therefore its filename)
as `<project-slug>_<entry-slug>`, so a human browsing the archive can see an
entry's project at a glance without opening it to read frontmatter.

## 1. Motivation

Entries are stored at `<category>/<type>/<id>.md` (file-layout) or
`<category>/<type>/<id>/index.md` (dir-layout). The owning project lives only
in frontmatter (`project: archievement-plugin`). When browsing files manually
(Finder, editor, `git`, `ls`), the project is invisible — you must open each
file to learn where it belongs.

The user has been manually compensating: 11 of 11 `personal/unticketed` entries
carry a hand-typed `archievement-` prefix. But the practice is inconsistent and
not machine-meaningful:

- The hand-typed prefix is `archievement-`, not the real project slug
  `archievement-plugin`.
- `work/unticketed` entries (`egs-store-mcp`, `marketplace-review-plugin`) use
  descriptive names that match no project slug.
- Some `idea` entries carry the prefix; the project-less `mcp-transport-stdio-vs-http`
  does not.

The fix: make project ownership part of the `id` itself, by an unambiguous,
machine-parseable convention.

## 2. Goal & non-goals

### Goal

Every entry filename is **self-describing**: its project is readable directly
from the filename, and recoverable by code, without opening the file.

### Non-goals

- **No physical directory grouping by project.** The clean two-axis model
  (`category` × `type`) for the directory tree is preserved. Project appears in
  the *filename*, never as a directory level.
- **No migration, no legacy support.** This project is pre-1.0 and explicitly
  tolerates breaking changes. Existing pre-convention files are simply out of
  scope — the code does not special-case them, and we do not rename them. If a
  legacy entry ever needs the new shape, rename it by hand. Parsing assumes the
  new encoding unconditionally.
- **No new search index.** (Recall is the `find` skill's job, already shipped.)

## 3. Data model — the new `id` encoding

```
id = <project-slug> "_" <entry-slug>
```

- `_` (underscore) is the **sole** project/entry delimiter. It appears **exactly
  once** in every id — left of it is the project, right of it is the entry slug.
- Both segments may contain `-` internally; the single `_` keeps them
  unambiguously separable (e.g. `archievement-plugin_find-skill`).
- **No-project entries use the literal `tbd`** as the project segment
  (semantics: "unclassified for now, may be filled in later"). This guarantees
  the format is exception-free — every id has exactly one `_`.
- For `ticketed` entries the entry-slug segment keeps the existing
  `<TICKET>-<slug>` shape.
- **Neither segment may contain `_`.** Since `_` is the sole delimiter and
  `slugOf`/`projectOf` split on the *first* `_`, an underscore inside the
  project or entry slug would corrupt parsing. `record` and `promote` use
  kebab-case slugs (hyphens only), so this holds by construction;
  `makeId` is where it is enforced (reject an argument containing `_`).

Examples on disk:

```
personal/idea/tbd_mcp-transport-stdio-vs-http.md
personal/unticketed/archievement-plugin_find-skill.md
work/ticketed/egs-mobile_EGA-5971-voice-refactor.md
work/ticketed/egs-mobile_EGA-5971.md          # ticket with no slug suffix is valid
```

**Key invariant:** `id` remains the system's primary key. `path.js` still builds
paths from `ptr.id` verbatim, so the `<category>/<type>/` directory structure is
unchanged. Project is encoded in the filename, not the directory layout.

**Source of truth:** frontmatter `project` stays authoritative for reports and
filters; the filename's project segment is a human-readable mirror of it.
`record` sets both from the same source (the SessionStart project slug, or
`tbd`), so they never diverge for new entries. If they ever disagree on a
hand-edited file, frontmatter wins.

## 4. `slugOf` — two-stage parsing (the promote lifeline)

`slugOf(ptr)` is the cross-bucket identity used by promote's slug-preservation
check (`orchestrate.js:26` enforces `slugOf(from) === slugOf(to)`). Under the
new encoding it must **strip in two stages**:

```
egs-mobile_EGA-5971-voice-refactor
  (1) strip the project segment (everything up to and including the first "_")
        → EGA-5971-voice-refactor
  (2) if ticketed, strip the ticket prefix /^[A-Z][A-Z0-9]*-\d+-/
        → voice-refactor          ← the preserved identity
```

For non-ticketed types, stage 2 is a no-op, so `slugOf` returns the entry-slug
segment as-is.

### 4.1 Why two stages (worked promote example)

Promoting `personal/idea/tbd_mcp-transport-stdio-vs-http` to
`personal/unticketed/archievement-plugin_mcp-transport-stdio-vs-http`:

- `slugOf(from)` strips `tbd_` → `mcp-transport-stdio-vs-http`
- `slugOf(to)` strips `archievement-plugin_` → `mcp-transport-stdio-vs-http`
- The two are equal → slug preservation passes.

Because the project segment is stripped *before* comparison, the project may
change across a promote while the entry-slug stays constant. This is intended
(see §5).

### 4.2 New helper: `projectOf`

```
projectOf(ptr) → the project segment (everything before the first "_"),
                 e.g. "archievement-plugin", "egs-mobile", or "tbd".
```

Used by `find` / reports to display or group by project ownership. Every id has
a project segment by construction (`tbd` at minimum), so `projectOf` always
returns a non-empty string.

### 4.3 New helper: `makeId`

```
makeId(projectSlug, entrySlug) → `${projectSlug || "tbd"}_${entrySlug}`
```

A single construction point so `record` / `promote` never hand-concatenate.
A falsy/empty project yields the `tbd` placeholder.

### 4.4 No legacy compatibility

This is a clean break — the project does not preserve compatibility with the
pre-convention ids (the existing files). `slugOf` and `projectOf` unconditionally
assume the `<project>_<slug>` shape and split on the first `_`; they carry no
no-`_` fallback branch. Existing entries that predate the convention are out of
scope (see §2). This keeps the parsing logic minimal and exception-free.

## 5. Promote semantics — project may change

With the project segment excluded from `slugOf`, promote's invariant relaxes:
**the entry-slug is preserved; the project segment may be filled in or changed.**

- `tbd_foo` (idea) → `archievement-plugin_foo` (unticketed): allowed — this is
  how an unclassified idea acquires a real project on graduation.
- The entry-slug (`foo`) must still match on both sides; promote across
  *different* entry-slugs remains an error.

`orchestrate.js` needs no change: it only calls `slugOf`, so the relaxed
behavior follows automatically from the new `slugOf`.

## 6. Affected files

| File | Change | Nature |
| --- | --- | --- |
| `lib/entries/path.js` | `slugOf` two-stage parse; new `projectOf`; new `makeId` | **Core** |
| `skills/record/SKILL.md` | Build new-entry id via `<project>_<slug>`; project from SessionStart context slug, else `tbd` | **Core** |
| `skills/promote/SKILL.md` | Document target-id construction (project segment; promote may fill in/change project) | Follow |
| `skills/find/SKILL.md` | May group/filter recall results by `projectOf` | Follow |
| `test/entries/path.test.js` | Rewrite `slugOf` suite for the new encoding + new `projectOf` / `makeId` cases | Test |

**Unchanged by design:** `list.js` (walks directories, never parses id
internals), `create.js` (accepts any id transparently), `update.js`,
`orchestrate.js` / `move.js` (only call `slugOf`), `session-start.js` (only
displays id), and the directory structure.

## 7. Testing

All in `test/entries/path.test.js`. The existing `slugOf` suite is **rewritten**
for the new encoding (its old fixtures used bare ids without a project segment,
which no longer occur):

- `slugOf` strips `project_` then ticket prefix:
  `egs-mobile_EGA-5971-voice-refactor` → `voice-refactor`.
- `slugOf` on non-ticketed strips only the project:
  `archievement-plugin_find-skill` → `find-skill`.
- `slugOf` `tbd` project: `tbd_mcp-transport-stdio-vs-http` →
  `mcp-transport-stdio-vs-http`.
- `slugOf` project + ticket with no slug suffix (the real `work/ticketed`
  shape): `egs-mobile_EGA-5971` strips `egs-mobile_` → `EGA-5971`, then the
  ticket-prefix regex finds no trailing slug to strip → `EGA-5971` unchanged.
- `slugOf` ticketed slug starting with a digit:
  `egs-mobile_EGA-5971-2023-retro` → `2023-retro`.
- `projectOf`: `archievement-plugin_find-skill` → `archievement-plugin`;
  `tbd_foo` → `tbd`.
- `makeId`: `makeId("egs-mobile", "EGA-5971")` → `egs-mobile_EGA-5971`;
  `makeId("", "foo")` → `tbd_foo`; `makeId(null, "foo")` → `tbd_foo`.
- Promote preservation holds across a project change:
  `slugOf(tbd_foo) === slugOf(archievement-plugin_foo)`.

Any other test in the suite that constructs a pointer id (promote, list,
session-start fixtures) is updated to the `<project>_<slug>` shape so the full
`npm test` stays green.

## 8. Invariants

- **Every id has exactly one `_`.** Project segment is never empty —
  `tbd` is the placeholder.
- **`id` is still the primary key.** Directory layout (`category/type/`) is
  unchanged; project is in the filename only.
- **`slugOf` preserves the entry-slug identity across promote**, ignoring the
  project segment, so promote may fill in or change the project.
- **Clean break, no legacy support.** Parsing assumes the `<project>_<slug>`
  shape unconditionally; pre-convention ids are out of scope.
- **Frontmatter `project` remains authoritative** for reports/filters; the
  filename segment is a human-readable mirror, and `record` sets both from the
  same source.
