# find skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `archievement:find` skill that reliably resolves the archievement root and recalls content within it (by filename/slug, full-text, or frontmatter), and inject the root path into SessionStart context so the assistant never again greps the wrong directory.

**Architecture:** Three thin change surfaces, zero new `lib/` modules. The skill is pure prose orchestrating the assistant's native `Grep`/`Glob` plus the existing `listEntries`; the LLM extracts retrieval signals and ranks results. One small `SessionStart` hook change adds the root path to context (defense-in-depth). The skill never depends on the hook — it always resolves the root itself.

**Tech Stack:** Node.js 20+ ESM, plain JS + JSDoc (no TypeScript), `node:test`, `gray-matter`. Skill artifacts are markdown.

**Spec:** [`docs/superpowers/specs/2026-06-06-find-skill-design.md`](../specs/2026-06-06-find-skill-design.md)

---

## Commit policy (read before executing)

- Per the user's standing preference, **commit and push only on the user's explicit go-ahead.** The commit steps below are the intended structure; confirm with the user before the first commit, and never `git push` unprompted.
- **The first commit bundles the spec + this plan together** (user instruction: the spec is not committed alone). That is Task 1.
- Squashing the per-task commits before a PR is fine.
- **PR title convention:** lead with an imperative verb (`Add`), no gerunds, no conventional-commits prefix. Suggested PR title: `Add find skill and inject archievement root into SessionStart context`.

## File structure

| File | Change | Responsibility |
| --- | --- | --- |
| `docs/superpowers/specs/2026-06-06-find-skill-design.md` | exists (uncommitted) | Design spec |
| `docs/superpowers/plans/2026-06-06-find-skill.md` | this file | Implementation plan |
| `skills/find/SKILL.md` | **create** | The find skill (prose): resolve-root-first recall by filename/content/frontmatter |
| `lib/hooks/session-start.js` | modify (`match` + `unknown` branches) | Inject `archievement root: <path>` line when a root is configured |
| `test/hooks/session-start.test.js` | modify (2 existing tests) | Assert the new root line; regression-guard `ignored` + null-root |
| `CLAUDE.md` | modify (lines 65–66, 94, 96) | Skill inventory 5 → 6; §10 status row |
| `README.md` | modify (after line 34) | Skill list adds `find` |

No new `lib/` code, no new test file. The find skill is validated by the existing auto-discovering `test/skills.test.js`.

---

## Task 1: Commit the spec and plan together

**Files:**
- Commit: `docs/superpowers/specs/2026-06-06-find-skill-design.md`
- Commit: `docs/superpowers/plans/2026-06-06-find-skill.md`

- [ ] **Step 1: Confirm both docs are on disk**

Run: `ls docs/superpowers/specs/2026-06-06-find-skill-design.md docs/superpowers/plans/2026-06-06-find-skill.md`
Expected: both paths listed, no "No such file".

- [ ] **Step 2: Commit (on user's go-ahead)**

```bash
git add docs/superpowers/specs/2026-06-06-find-skill-design.md docs/superpowers/plans/2026-06-06-find-skill.md
git commit -m "Add find skill design spec and implementation plan"
```

---

## Task 2: Inject `archievement root:` into SessionStart context

The `match` and `unknown` branches gain an `archievement root: <path>` line. The `ignored` branch stays silent. The null-root early return (line 30–32) is unchanged.

**Files:**
- Modify: `lib/hooks/session-start.js` (the `unknown` branch at `:41-50`, the `match` branch `lines` array at `:56-65`)
- Test: `test/hooks/session-start.test.js` (the two tests at `:25-42` and `:44-81`)

- [ ] **Step 1: Write the failing assertions**

In `test/hooks/session-start.test.js`, in the test `"runSessionStart injects 'unregistered' when project not in config"`, add this line immediately after the existing `assert.match(... /\/archievement:project-setup/)` assertion (currently line 39):

```js
      assert.ok(result.additionalContext.includes(`archievement root: ${root}`));
```

In the test `"runSessionStart injects active entries when project is registered"`, add this line immediately after the existing `assert.match(... /PROJ-1 \(todo\)/)` assertion (currently line 78):

```js
      assert.ok(result.additionalContext.includes(`archievement root: ${root}`));
```

Leave the two regression tests untouched — `"...not set up"` (asserts `""`) and `"...stays silent for explicitly-ignored cwd"` (asserts `""`) already guard the null-root and `ignored` behavior.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/hooks/session-start.test.js`
Expected: FAIL — the two new `assert.ok(... includes("archievement root: ..."))` assertions fail because the hook does not yet emit the root line.

- [ ] **Step 3: Modify the `unknown` branch**

In `lib/hooks/session-start.js`, replace the `unknown` branch:

```js
  if (result.kind === "unknown") {
    return {
      additionalContext: wrap(
        [
          "unregistered project — cwd is not in archievement's projects list.",
          "Run /archievement:project-setup to register or ignore this project.",
        ].join("\n"),
      ),
    };
  }
```

with:

```js
  if (result.kind === "unknown") {
    return {
      additionalContext: wrap(
        [
          `archievement root: ${root}`,
          "unregistered project — cwd is not in archievement's projects list.",
          "Run /archievement:project-setup to register or ignore this project.",
        ].join("\n"),
      ),
    };
  }
```

- [ ] **Step 4: Modify the `match` branch**

In the same file, change the `lines` array so `archievement root` is the first element:

```js
  const lines = [
    `project: ${project.slug}`,
    `category: ${project.category}`,
```

becomes:

```js
  const lines = [
    `archievement root: ${root}`,
    `project: ${project.slug}`,
    `category: ${project.category}`,
```

(The rest of the array — language, blank line, active entries — is unchanged. `root` is already in scope from `const root = config.archievement_root;` at the top of the function, guaranteed non-null past the early return.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test test/hooks/session-start.test.js`
Expected: PASS — all four tests green.

- [ ] **Step 6: Run Prettier on the changed JS**

Run: `npx prettier --check lib/hooks/session-start.js test/hooks/session-start.test.js`
Expected: "All matched files use Prettier code style!"
If it reports issues, run `npx prettier --write` on the two files and re-run the check.

- [ ] **Step 7: Commit**

```bash
git add lib/hooks/session-start.js test/hooks/session-start.test.js
git commit -m "Inject archievement root into SessionStart context"
```

---

## Task 3: Add the find skill

The skill is prose. There is **no new unit test** — `test/skills.test.js` auto-discovers every `skills/*/SKILL.md` and validates frontmatter + body length, so the new skill is covered the moment the file exists.

**Files:**
- Create: `skills/find/SKILL.md`

- [ ] **Step 1: Confirm the sanity test currently passes with 5 skills**

Run: `node --test test/skills.test.js`
Expected: PASS (1 test). This is the baseline before adding the 6th skill.

- [ ] **Step 2: Create `skills/find/SKILL.md`**

Write this exact content:

````markdown
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

## Invariants

- **Resolve the root before searching, every time.** Never grep the cwd; never
  use a default path. If the root is unset, STOP and point at
  `/archievement:setup`.
- **`find` is read-only.** It never writes to disk.
- **`reports/` is excluded** from content search — only entry documents under
  `work/` and `personal/`.
- **Recall is language-agnostic** (query keywords may be Chinese), but the
  skill's own artifacts stay English per convention.
````

- [ ] **Step 3: Run the sanity test to verify the new skill passes validation**

Run: `node --test test/skills.test.js`
Expected: PASS. The test now iterates 6 skill directories including `find`; its frontmatter (`name: find`, the long `description`) and body length satisfy every assertion.

- [ ] **Step 4: Commit**

```bash
git add skills/find/SKILL.md
git commit -m "Add find skill for locating archieved content"
```

---

## Task 4: Update CLAUDE.md and README

**Files:**
- Modify: `CLAUDE.md` (lines 65–66, the §10 status table, line 96)
- Modify: `README.md` (after line 34)

- [ ] **Step 1: Update the skills-directory description in CLAUDE.md**

Replace (line 65–66):

```
skills/                        5 user-facing skill markdowns (§6, §9)
  setup / record / promote / report / project-setup
```

with:

```
skills/                        6 user-facing skill markdowns (§6, §9, §10)
  setup / record / promote / report / project-setup / find
```

- [ ] **Step 2: Add a §10 row to the execution-status table in CLAUDE.md**

After the `§9 project-setup skill` row (line 94), add:

```
| §10 find skill | ✅ Shipped | follow-up — find SKILL.md (resolve-root-first recall by filename/content/frontmatter via native Grep/Glob + listEntries, reports excluded) + SessionStart injects `archievement root:` into match/unknown context |
```

- [ ] **Step 3: Update the closing summary line in CLAUDE.md**

Replace (line 96):

```
All 8 plan sections plus the §9 project-setup follow-up shipped. The plan in `docs/superpowers/plans/2026-05-23-archievement-implementation.md` is complete.
```

with:

```
All 8 plan sections plus the §9 project-setup and §10 find follow-ups shipped. The plan in `docs/superpowers/plans/2026-05-23-archievement-implementation.md` is complete.
```

- [ ] **Step 4: Add the find skill to the README daily-use list**

In `README.md`, after the `project-setup` bullet (line 34):

```
- `/archievement:project-setup` — view, register, modify, or ignore the current project's config (slug, category, language).
```

add:

```
- `/archievement:find` — locate or recall an archieved entry by filename/slug, topic/keyword, or frontmatter (read-only).
```

- [ ] **Step 5: Verify the docs render and reference the right counts**

Run: `grep -n "find" CLAUDE.md README.md`
Expected: the new skill-list entry, the §10 row, and the README bullet all appear; the inventory says "6 user-facing skill markdowns".

(Prettier ignores `*.md`, so no format check is needed for these files.)

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "Document find skill in CLAUDE.md and README"
```

---

## Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the 4 session-start tests and the skills sanity test (now covering 6 skills). No failures, no errors.

- [ ] **Step 2: Run the format check**

Run: `npm run format:check`
Expected: "All matched files use Prettier code style!" (markdown is ignored per `.prettierignore`; the only changed code files are the hook and its test, both formatted in Task 2).

- [ ] **Step 3: Confirm the change set**

Run: `git log --oneline -5` and `git status`
Expected: the Task 1–4 commits present; working tree clean.

---

## Self-review

**1. Spec coverage** — every spec section maps to a task:

- §1 Motivation / §2 Goals → Task 3 (skill) + Task 2 (hook) jointly realize both root-cause fixes.
- §3 Architecture (3 surfaces, no new lib) → Tasks 2, 3, 4; "no new lib" honored (recall uses native tools + `listEntries`).
- §4 find flow (resolve → extract → recall → rank → present) → Task 3 Step 2 SKILL.md `## Flow`.
- §5 hook change (match + unknown gain root; ignored silent; null-root unchanged) → Task 2 Steps 3–4; regression guards in Step 1.
- §6 triggering (description + red line) → Task 3 SKILL.md frontmatter `description` + `## Red line`.
- §7 testing & docs → Task 2 (hook tests), Task 3 Step 3 (skills sanity), Task 4 (docs), Task 5 (full suite).
- §8 invariants → Task 3 SKILL.md `## Invariants`.

No gaps.

**2. Placeholder scan** — no "TBD/TODO/handle edge cases"; all code and prose shown in full. The `<kw>` / `FILTERS` / `<root>` tokens inside the SKILL.md are intentional runtime placeholders the skill instructs the assistant to substitute, not plan placeholders.

**3. Type/name consistency** — `archievement root:` label is identical in the hook (Task 2), the spec, the skill's shortcut note, and the §10 row. `listEntries` filter keys (`category`/`type`/`status`/`project`) match `lib/entries/list.js`. `resolveArchievementRoot({ pluginConfigPath })` signature matches the existing record/report/project-setup skills verbatim.
