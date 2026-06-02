# project-setup Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5th user-facing skill, `project-setup`, that views / registers / modifies / ignores project config for the current working directory, backed by three new pure config helpers.

**Architecture:** Three new immutable pure transforms join `lib/config/plugin.js` (`updateProject`, `removeProject`, `removeIgnore`). A new `skills/project-setup/SKILL.md` drives them via `node -e` one-liners, classifying the current cwd with the existing `getProjectProbe` + `matchProject` and presenting a `show` / `configure` / `ignore` menu. The SessionStart hook's unknown-project nudge is updated to name the new skill.

**Tech Stack:** Node.js 20+ ESM, `node:test`, `js-yaml`, Prettier. No new dependencies.

**Spec:** [`docs/superpowers/specs/2026-06-01-project-setup-skill-design.md`](../specs/2026-06-01-project-setup-skill-design.md)

---

## File structure

- **Modify** `lib/config/plugin.js` — add `updateProject`, `removeProject`, `removeIgnore` (after `addIgnore`, before `rememberLanguage`).
- **Modify** `test/config/plugin.test.js` — add a test block for the three helpers (after the `addIgnore` test).
- **Modify** `lib/hooks/session-start.js` — name the skill in the `unknown` branch message.
- **Modify** `test/hooks/session-start.test.js` — assert the skill name appears.
- **Create** `skills/project-setup/SKILL.md` — the skill body.
- **Modify** `README.md` — list the new skill under "Daily use".
- **Modify** `CLAUDE.md` — skills count 4 → 5, repo-layout note, execution-status row.

All five existing config-helper tests and four session-start tests must keep passing.

---

## Task 1: `updateProject` pure helper

**Files:**
- Modify: `lib/config/plugin.js` (add after `addIgnore`, ~line 294)
- Test: `test/config/plugin.test.js` (add after the `addIgnore appends to ignore list` test, ~line 405)

- [ ] **Step 1: Write the failing tests**

Add to `test/config/plugin.test.js` after the `addIgnore appends to ignore list` test:

```js
// --- updateProject / removeProject / removeIgnore -------------------------

test("updateProject merges a patch into the slug-matching project", () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    projects: [
      { match: { type: "path", path: "/p" }, slug: "a", category: "work", language: "en" },
      { match: { type: "path", path: "/q" }, slug: "b", category: "personal" },
    ],
  };
  const next = updateProject(cfg, "a", { category: "personal", language: "zh" });
  assert.equal(next.projects[0].category, "personal");
  assert.equal(next.projects[0].language, "zh");
  assert.equal(next.projects[0].slug, "a", "slug is preserved");
  assert.equal(next.projects[1].category, "personal", "other projects untouched");
});

test("updateProject returns config unchanged when no slug matches", () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    projects: [{ match: { type: "path", path: "/p" }, slug: "a", category: "work" }],
  };
  const next = updateProject(cfg, "missing", { category: "personal" });
  assert.deepEqual(next.projects, cfg.projects);
});
```

- [ ] **Step 2: Add the import**

In `test/config/plugin.test.js`, extend the import from `../../lib/config/plugin.js` (lines 8-18) to include `updateProject`:

```js
  addIgnore,
  updateProject,
  rememberLanguage,
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test 2>&1 | grep -A2 updateProject`
Expected: FAIL — `updateProject is not a function` / `not defined`.

- [ ] **Step 4: Write the implementation**

Add to `lib/config/plugin.js` after `addIgnore` (after ~line 294):

```js
/**
 * Pure: merge `patch` into the project whose slug matches `slug`, returning a
 * new config. Slug is never overwritten by a patch unless the patch sets it.
 * No matching slug → config returned unchanged.
 *
 * @template {{ projects: ProjectEntry[] }} T
 * @param {T} config
 * @param {string} slug
 * @param {Partial<ProjectEntry>} patch
 * @returns {T}
 */
export function updateProject(config, slug, patch) {
  return {
    ...config,
    projects: config.projects.map((p) => (p.slug === slug ? { ...p, ...patch } : p)),
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test 2>&1 | grep -A2 updateProject`
Expected: PASS (both `updateProject` tests).

- [ ] **Step 6: Commit**

```bash
git add lib/config/plugin.js test/config/plugin.test.js
git commit -m "$(cat <<'EOF'
Add updateProject pure config helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `removeProject` pure helper

**Files:**
- Modify: `lib/config/plugin.js` (add after `updateProject`)
- Test: `test/config/plugin.test.js` (add after the `updateProject` tests)

- [ ] **Step 1: Write the failing tests**

Add to `test/config/plugin.test.js` after the `updateProject` tests:

```js
test("removeProject filters out the slug-matching project", () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    projects: [
      { match: { type: "path", path: "/p" }, slug: "a", category: "work" },
      { match: { type: "path", path: "/q" }, slug: "b", category: "personal" },
    ],
  };
  const next = removeProject(cfg, "a");
  assert.equal(next.projects.length, 1);
  assert.equal(next.projects[0].slug, "b");
});

test("removeProject returns config unchanged when no slug matches", () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    projects: [{ match: { type: "path", path: "/p" }, slug: "a", category: "work" }],
  };
  const next = removeProject(cfg, "missing");
  assert.equal(next.projects.length, 1);
});
```

- [ ] **Step 2: Add the import**

In `test/config/plugin.test.js`, add `removeProject` to the import:

```js
  updateProject,
  removeProject,
  rememberLanguage,
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test 2>&1 | grep -A2 removeProject`
Expected: FAIL — `removeProject is not a function`.

- [ ] **Step 4: Write the implementation**

Add to `lib/config/plugin.js` after `updateProject`:

```js
/**
 * Pure: return a new config with the slug-matching project removed. No match →
 * config returned unchanged (an empty filter result is still a new array).
 *
 * @template {{ projects: ProjectEntry[] }} T
 * @param {T} config
 * @param {string} slug
 * @returns {T}
 */
export function removeProject(config, slug) {
  return { ...config, projects: config.projects.filter((p) => p.slug !== slug) };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test 2>&1 | grep -A2 removeProject`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/config/plugin.js test/config/plugin.test.js
git commit -m "$(cat <<'EOF'
Add removeProject pure config helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `removeIgnore` pure helper

**Spec deviation (intentional):** the spec wrote `removeIgnore(config, matcher)`. This task implements `removeIgnore(config, probe)` instead — taking the same `{ remote, cwd }` probe that `matchProject` consumes and reusing the module-private `matcherMatches`. This removes exactly the ignore entries that `matchProject` would flag for the current cwd, guaranteeing the unignore toggle is the precise inverse of the "ignored" classification, and avoids adding a separate matcher-equality function.

**Files:**
- Modify: `lib/config/plugin.js` (add after `removeProject`)
- Test: `test/config/plugin.test.js` (add after the `removeProject` tests)

- [ ] **Step 1: Write the failing tests**

Add to `test/config/plugin.test.js` after the `removeProject` tests:

```js
test("removeIgnore filters the ignore entry matching a path probe", () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    ignore: [
      { match: { type: "path", path: "/tmp/a" } },
      { match: { type: "path", path: "/tmp/b" } },
    ],
  };
  const next = removeIgnore(cfg, { remote: null, cwd: "/tmp/a" });
  assert.equal(next.ignore.length, 1);
  assert.equal(next.ignore[0].match.path, "/tmp/b");
});

test("removeIgnore filters the ignore entry matching a git-remote probe", () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    ignore: [{ match: { type: "git-remote", url: "github.com/me/x" } }],
  };
  const next = removeIgnore(cfg, { remote: "github.com/me/x", cwd: "/anywhere" });
  assert.equal(next.ignore.length, 0);
});

test("removeIgnore returns config unchanged when nothing matches the probe", () => {
  const cfg = {
    ...DEFAULT_CONFIG,
    ignore: [{ match: { type: "path", path: "/tmp/a" } }],
  };
  const next = removeIgnore(cfg, { remote: null, cwd: "/tmp/other" });
  assert.equal(next.ignore.length, 1);
});
```

- [ ] **Step 2: Add the import**

In `test/config/plugin.test.js`, add `removeIgnore` to the import:

```js
  removeProject,
  removeIgnore,
  rememberLanguage,
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test 2>&1 | grep -A2 removeIgnore`
Expected: FAIL — `removeIgnore is not a function`.

- [ ] **Step 4: Write the implementation**

Add to `lib/config/plugin.js` after `removeProject`. `matcherMatches` already exists in this module (private), so it can be referenced directly:

```js
/**
 * Pure: return a new config with every ignore entry that matches `probe`
 * removed — the exact inverse of the `kind: "ignored"` result from
 * `matchProject`. No match → config returned unchanged.
 *
 * @template {{ ignore: IgnoreEntry[] }} T
 * @param {T} config
 * @param {Probe} probe
 * @returns {T}
 */
export function removeIgnore(config, probe) {
  return { ...config, ignore: config.ignore.filter((ig) => !matcherMatches(ig.match, probe)) };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test 2>&1 | grep -A2 removeIgnore`
Expected: PASS (all three).

- [ ] **Step 6: Run the full config suite to confirm no regressions**

Run: `node --test test/config/plugin.test.js`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/config/plugin.js test/config/plugin.test.js
git commit -m "$(cat <<'EOF'
Add removeIgnore pure config helper

Takes a probe (not a bare matcher) and reuses matcherMatches, so unignore is
the exact inverse of matchProject's ignored classification.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Name the skill in the SessionStart nudge

**Files:**
- Modify: `lib/hooks/session-start.js:42-49` (the `unknown` branch)
- Test: `test/hooks/session-start.test.js:25-41`

- [ ] **Step 1: Update the failing test first**

In `test/hooks/session-start.test.js`, inside the `runSessionStart injects 'unregistered' when project not in config` test, add an assertion after the existing `/unregistered project/` assertion (~line 38):

```js
      assert.match(result.additionalContext, /unregistered project/);
      assert.match(result.additionalContext, /\/archievement:project-setup/);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/hooks/session-start.test.js`
Expected: FAIL — the `/archievement:project-setup` assertion fails (message doesn't name the skill yet).

- [ ] **Step 3: Update the implementation**

In `lib/hooks/session-start.js`, replace the second line of the `unknown` branch array (currently `"If any archievement skill is invoked, prompt the user to register or ignore this project."`) so the branch reads:

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

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/hooks/session-start.test.js`
Expected: PASS (all four session-start tests).

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/session-start.js test/hooks/session-start.test.js
git commit -m "$(cat <<'EOF'
Name project-setup skill in SessionStart unregistered nudge

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create the `project-setup` SKILL.md

**Files:**
- Create: `skills/project-setup/SKILL.md`

The shared `test/skills.test.js` auto-validates the `name` / `description` frontmatter of every skill, so creating the file is itself the test.

- [ ] **Step 1: Write the skill file**

Create `skills/project-setup/SKILL.md` with exactly this content:

````markdown
---
name: project-setup
description: View, register, modify, or ignore the current project's archievement config (slug, category, language). Distinct from setup, which is the one-time global initialization.
---

# archievement:project-setup

Manage how the **current working directory** is registered in archievement's
unified config: view all registrations, register/modify the current project, or
toggle it on the ignore list.

> Not to be confused with `/archievement:setup`. `setup` is the **one-time
> global** initialization (root path, default language, directory skeleton).
> `project-setup` is the **recurring per-project** registration tool. It only
> reads and writes the local config — it calls no external API.

## Read first

1. **archievement root**: resolve via `lib/config/plugin.js`. Pass the
   plugin-data path explicitly — Claude Code substitutes `${CLAUDE_PLUGIN_DATA}`
   in skill content, but does NOT inject it as an env var into the Bash
   subprocess:

   ```
   node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ resolveArchievementRoot }) => process.stdout.write(resolveArchievementRoot({ pluginConfigPath: '${CLAUDE_PLUGIN_DATA}/config.yml' }) ?? ''))"
   ```

   If the output is empty, STOP. Tell the user: "archievement is not set up. Run
   `/archievement:setup` first." Do NOT search the filesystem or use a default
   path.

2. **Classify the current cwd**: run one snippet to get the probe, the match
   result, and the lists needed to render the menu and prompts:

   ```
   node -e "
     Promise.all([
       import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js'),
       import('${CLAUDE_PLUGIN_ROOT}/lib/git.js'),
     ]).then(([{ loadConfig, matchProject }, { getProjectProbe }]) => {
       const cfg = loadConfig({ pluginConfigPath: '${CLAUDE_PLUGIN_DATA}/config.yml' });
       const probe = getProjectProbe(process.cwd());
       process.stdout.write(JSON.stringify({
         probe,
         result: matchProject(cfg, probe),
         projects: cfg.projects,
         ignore: cfg.ignore,
         languages_known: cfg.languages_known,
         default_language: cfg.default_language,
       }));
     });
   "
   ```

   `result.kind` is `match`, `ignored`, or `unknown`. Use it to label the menu.

## Flow

Top-level AskUserQuestion — "What do you want to do?" with three options, their
descriptions reflecting the current cwd state:

| Option | Description shown |
|---|---|
| **show** | List all registered projects + the ignore list (read-only). |
| **configure** | Register this project (if `unknown`) or modify/remove it (if `match`). |
| **ignore** | Add this directory to the ignore list (if not ignored) or remove it (if `ignored`). |

### show

Print the `projects` and `ignore` arrays from the classify snippet in a readable
form. Mark the entry whose match equals the current `probe` (i.e. `result.kind
=== "match"` / `"ignored"`). Make no writes.

### configure — when `result.kind === "unknown"` (register)

1. AskUserQuestion **slug** (kebab-case). If the slug already appears in
   `projects`, warn but allow.
2. AskUserQuestion **category**: `work / personal`.
3. AskUserQuestion **language**: build options from `languages_known` plus
   `English`, mirroring the `setup` skill. Allow "specify another".
4. Build the matcher from the probe: `git-remote` with `probe.remote` when it is
   non-null, otherwise `path` with `probe.cwd`. Then write:

   ```
   node -e "
     import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ loadConfig, addProject, saveConfig }) => {
       const p = '${CLAUDE_PLUGIN_DATA}/config.yml';
       const cfg = loadConfig({ pluginConfigPath: p });
       const match = REMOTE ? { type: 'git-remote', url: REMOTE } : { type: 'path', path: CWD };
       saveConfig({ pluginConfigPath: p }, addProject(cfg, { match, slug: SLUG, category: CATEGORY, language: LANGUAGE }));
     });
   "
   ```

   Substitute `REMOTE` / `CWD` / `SLUG` / `CATEGORY` / `LANGUAGE` with quoted JS
   string literals (or `null` for `REMOTE` when there is no remote).

### configure — when `result.kind === "match"` (modify / remove)

1. Show the current `slug` / `category` / `language` from `result.project`.
2. AskUserQuestion: `Modify a field / Remove this registration / Cancel`.
3. **Modify**: AskUserQuestion which field (`slug / category / language`),
   collect the new value, then write with `updateProject` keyed by the CURRENT
   slug:

   ```
   node -e "
     import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ loadConfig, updateProject, saveConfig }) => {
       const p = '${CLAUDE_PLUGIN_DATA}/config.yml';
       const cfg = loadConfig({ pluginConfigPath: p });
       saveConfig({ pluginConfigPath: p }, updateProject(cfg, CURRENT_SLUG, PATCH));
     });
   "
   ```

   `PATCH` is a JS object literal of only the changed fields, e.g. `{ category: 'personal' }`.

4. **Remove**: confirm, then `removeProject(cfg, CURRENT_SLUG)`:

   ```
   node -e "
     import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ loadConfig, removeProject, saveConfig }) => {
       const p = '${CLAUDE_PLUGIN_DATA}/config.yml';
       const cfg = loadConfig({ pluginConfigPath: p });
       saveConfig({ pluginConfigPath: p }, removeProject(cfg, CURRENT_SLUG));
     });
   "
   ```

### ignore — toggle

- When `result.kind !== "ignored"`: add the current directory. Build the matcher
  exactly as in register (git-remote when `probe.remote`, else path) and call
  `addIgnore`:

  ```
  node -e "
    import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js').then(({ loadConfig, addIgnore, saveConfig }) => {
      const p = '${CLAUDE_PLUGIN_DATA}/config.yml';
      const cfg = loadConfig({ pluginConfigPath: p });
      const match = REMOTE ? { type: 'git-remote', url: REMOTE } : { type: 'path', path: CWD };
      saveConfig({ pluginConfigPath: p }, addIgnore(cfg, { match }));
    });
  "
  ```

- When `result.kind === "ignored"`: remove it by passing the probe to
  `removeIgnore`:

  ```
  node -e "
    Promise.all([
      import('${CLAUDE_PLUGIN_ROOT}/lib/config/plugin.js'),
      import('${CLAUDE_PLUGIN_ROOT}/lib/git.js'),
    ]).then(([{ loadConfig, removeIgnore, saveConfig }, { getProjectProbe }]) => {
      const p = '${CLAUDE_PLUGIN_DATA}/config.yml';
      const cfg = loadConfig({ pluginConfigPath: p });
      saveConfig({ pluginConfigPath: p }, removeIgnore(cfg, getProjectProbe(process.cwd())));
    });
  "
  ```

## Final report

After any write, tell the user exactly what changed (registered / modified which
field / removed / ignored / unignored) and the slug or path affected. For `show`,
just present the lists.

## Invariants

- **Never write without an explicit confirmation** for that specific action.
- **Never invent a slug, category, language, or path.** Pull from the probe or
  AskUserQuestion.
- **All operations target the current cwd.** To manage a different project, the
  user must `cd` there first; there is no cross-directory target picker.
- **Config is the single unified `${CLAUDE_PLUGIN_DATA}/config.yml`.** Never
  hand-edit YAML or write to a `<root>/config/` path.
````

- [ ] **Step 2: Run the skills sanity test**

Run: `node --test test/skills.test.js`
Expected: PASS — the new skill's frontmatter validates alongside the others.

- [ ] **Step 3: Check formatting**

Run: `npm run format:check`
Expected: PASS. If it fails, run `npm run format` and re-check. (Note: Prettier ignores `*.md`, so this is mainly a guard for the touched `.js` files.)

- [ ] **Step 4: Commit**

```bash
git add skills/project-setup/SKILL.md
git commit -m "$(cat <<'EOF'
Add project-setup skill for project-metadata management

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update docs (README + CLAUDE.md)

**Files:**
- Modify: `README.md:29-33` (the "Daily use" list)
- Modify: `CLAUDE.md` (skills count, repo layout, execution status)

- [ ] **Step 1: Update README "Daily use"**

In `README.md`, add a bullet to the "Daily use" list (after the `report` bullet, ~line 33):

```markdown
- `/archievement:project-setup` — view, register, modify, or ignore the current project's config (slug, category, language).
```

- [ ] **Step 2: Update CLAUDE.md skills references**

In `CLAUDE.md`, in the "Repository layout" section, change the `skills/` line from:

```
skills/                        4 user-facing skill markdowns (§6)
  setup / record / promote / report
```

to:

```
skills/                        5 user-facing skill markdowns (§6, §9)
  setup / record / promote / report / project-setup
```

- [ ] **Step 3: Add an execution-status row**

In `CLAUDE.md`, after the `§8 Polish` row in the "Execution status" table, add:

```
| §9 project-setup skill | ✅ Shipped | follow-up — updateProject / removeProject / removeIgnore helpers + project-setup skill (cwd-centric show/configure/ignore) + SessionStart nudge names the skill |
```

And update the closing line `All 8 sections shipped.` to `All 8 plan sections plus the §9 project-setup follow-up shipped.`

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass (including the new config helpers, updated session-start, and skills sanity).

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "$(cat <<'EOF'
Document project-setup skill in README and CLAUDE.md

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full test run**

Run: `npm test`
Expected: PASS, no failures.

- [ ] **Step 2: Format check**

Run: `npm run format:check`
Expected: PASS.

- [ ] **Step 3: Confirm the skill is discoverable**

Run: `ls skills/project-setup/SKILL.md && head -4 skills/project-setup/SKILL.md`
Expected: file exists; frontmatter shows `name: project-setup`.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin add-project-setup-skill
gh pr create --title "Add project-setup skill for project-metadata management" --body "$(cat <<'EOF'
## Summary

Adds a 5th user-facing skill, `project-setup`, closing the gap where no entry
point existed to view / register / modify / ignore a project's config —
`config.yml` could only be hand-edited.

- Three new pure config helpers in `lib/config/plugin.js`: `updateProject`,
  `removeProject`, `removeIgnore` (probe-based, reuses `matcherMatches`).
- New cwd-centric `skills/project-setup/SKILL.md` with a `show` / `configure` /
  `ignore` menu and smart upsert.
- SessionStart unregistered-project nudge now names `/archievement:project-setup`.
- README + CLAUDE.md updated.

Design: `docs/superpowers/specs/2026-06-01-project-setup-skill-design.md`

## Test plan

- New unit tests for the three helpers (`test/config/plugin.test.js`).
- Updated `test/hooks/session-start.test.js` asserts the skill name in the nudge.
- `test/skills.test.js` auto-validates the new skill's frontmatter.
- `npm test` and `npm run format:check` green.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage:**
- §2 Naming (`project-setup`, distinct from `setup`) → Task 5 frontmatter + body banner. ✅
- §3 Operation model (guard, probe, classify, show/configure/ignore menu, smart upsert, modify+remove sub-option, ignore toggle, matcher selection) → Task 5. ✅
- §4 lib changes (`updateProject`, `removeProject`, `removeIgnore`) → Tasks 1-3. ✅ (removeIgnore signature refined to probe-based — flagged in Task 3.)
- §5.1 SessionStart nudge → Task 4. ✅
- §5.2 Documentation → Task 6. ✅
- §6 Error handling (root null guard; path matcher fallback; no-op on missing target; slug-collision warn) → Tasks 1-3 (no-op tests) + Task 5 (guard, warn, matcher fallback). ✅
- §7 Testing (TDD for 3 helpers; skills.test.js auto-coverage) → Tasks 1-3, 5. ✅

**Placeholder scan:** No TBD/TODO. Every code step shows complete code. SKILL.md `node -e` snippets use named ALL-CAPS substitution tokens (`REMOTE`, `SLUG`, `PATCH`, …) that are explicitly defined as "fill with quoted JS literal" — these are skill-runtime instructions to Claude, not plan placeholders.

**Type consistency:** `updateProject(config, slug, patch)`, `removeProject(config, slug)`, `removeIgnore(config, probe)` — signatures identical across the plan body, tests, self-review, and SKILL.md usage. `Probe` / `ProjectEntry` / `IgnoreEntry` typedefs already exist in `plugin.js`. `matcherMatches` is referenced only inside `plugin.js` where it is in scope.
