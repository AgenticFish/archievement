# archievement Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the archievement Claude Code plugin — a private "work memory archiver" — end-to-end per the design spec at `docs/superpowers/specs/2026-05-23-archievement-plugin-design.md`.

**Architecture:** Claude Code plugin (skills + hooks) with a sink-not-source pattern. Skills are markdown files Claude reads; helper logic lives in Node.js modules under `lib/`. Bash hook wrappers exec Node helpers for cross-platform behavior. All persisted state is markdown + YAML frontmatter under a user-chosen root directory (default `~/archievement/`).

**Tech Stack:**
- Node.js 20+ (ESM)
- Claude Code plugin format (`.claude-plugin/plugin.json`, `skills/*/SKILL.md`, `hooks/`)
- Dependencies: `js-yaml`, `gray-matter`
- Testing: `node:test` (built-in)
- Formatting / linting: Prettier (JS/JSON/YAML/MD) + shellcheck (bash)
- CI: GitHub Actions

---

## File structure

```
archievement/
  .claude-plugin/
    plugin.json                         # plugin metadata
  .github/
    workflows/
      ci.yml                            # format + test jobs
  .prettierrc                           # Prettier config
  .prettierignore
  package.json                          # npm scripts + deps; "type": "module"
  README.md                             # install + usage
  hooks/
    hooks.json                          # SessionStart + PostToolUse registration
    run-hook.cmd                        # cross-platform wrapper (from superpowers, MIT)
    session-start                       # bash wrapper (extensionless)
    post-tool-use-gh-pr-create          # bash wrapper (extensionless)
  skills/
    setup/SKILL.md
    record/SKILL.md
    promote/SKILL.md
    report/SKILL.md
  lib/
    config/
      global.js                         # global.yml R/W
      projects.js                       # projects.yml R/W + matcher
      user-prefs.js                     # user-prefs.yml R/W
    git.js                              # git remote detection + normalization
    frontmatter.js                      # YAML frontmatter R/W (gray-matter wrapper)
    entries/
      path.js                           # canonical entry-path resolution
      create.js                         # create new entry (file or dir layout)
      read.js                           # read existing entry
      update.js                         # update frontmatter / append doc / write doc
      list.js                           # list entries with filters
    promote/
      expand.js                         # file → dir layout expansion
      move.js                           # physical move + reciprocal links
      orchestrate.js                    # full promote operation
    reports/
      stats.js                          # deterministic anchor numbers
      summary.js                        # in-progress snapshot
      completion.js                     # done in time range
      prediction.js                     # collect data for LLM prediction
      perf-review.js                    # collect data with hard category isolation
      write.js                          # write a report file with timestamped name
    hooks/
      session-start.js                  # SessionStart hook logic
      post-pr-create.js                 # PostToolUse(gh pr create) hook logic
  test/
    helpers/
      tmp.js                            # tmp dir helper for tests
    config/
      global.test.js
      projects.test.js
      user-prefs.test.js
    git.test.js
    frontmatter.test.js
    entries/
      path.test.js
      create.test.js
      read.test.js
      update.test.js
      list.test.js
    promote/
      expand.test.js
      move.test.js
      orchestrate.test.js
    reports/
      stats.test.js
      summary.test.js
      completion.test.js
      prediction.test.js
      perf-review.test.js
      write.test.js
    hooks/
      session-start.test.js
      post-pr-create.test.js
  docs/
    superpowers/
      specs/2026-05-23-archievement-plugin-design.md
      plans/2026-05-23-archievement-implementation.md
```

---

## Section 1 — Foundation

### Task 1: Initialize plugin metadata and Node project

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `package.json`

- [ ] **Step 1: Write `.claude-plugin/plugin.json`**

```json
{
  "name": "archievement",
  "description": "Private work-memory archiver — distills Claude Code session content into a structured local markdown tree, with reports and perf-review draft generation.",
  "version": "0.1.0",
  "author": {
    "name": "irene.yu"
  },
  "repository": "https://github.com/AgenticFish/archievement",
  "license": "MIT",
  "keywords": ["personal-tracking", "work-log", "perf-review", "markdown"]
}
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "archievement",
  "version": "0.1.0",
  "description": "Claude Code plugin: private work-memory archiver.",
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "test": "node --test test/",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "dependencies": {
    "gray-matter": "^4.0.3",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "prettier": "^3.3.0"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: `package-lock.json` created; `node_modules/` populated; no errors.

- [ ] **Step 4: Verify Node version**

Run: `node --version`
Expected: `v20.x.x` or higher. If older, abort and upgrade Node first.

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin/plugin.json package.json package-lock.json
git commit -m "Add plugin metadata and Node project skeleton"
```

(Do not commit `node_modules/`; it must already be in `.gitignore`. If not, add it here.)

- [ ] **Step 6: Verify `node_modules` ignored**

Run: `git status`
Expected: `node_modules/` not listed. If it appears, append `node_modules/` to `.gitignore` and commit that separately:

```bash
echo "node_modules/" >> .gitignore
git add .gitignore
git commit -m "Ignore node_modules"
```

---

### Task 2: Test infrastructure sanity check

**Files:**
- Create: `test/sanity.test.js`

- [ ] **Step 1: Write the sanity test**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";

test("test runner is wired up", () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 2: Run the test**

Run: `npm test`
Expected: `# pass 1` (1 passing test, 0 failing).

- [ ] **Step 3: Commit**

```bash
git add test/sanity.test.js
git commit -m "Add test infrastructure with node:test sanity check"
```

---

### Task 3: Prettier configuration

**Files:**
- Create: `.prettierrc`
- Create: `.prettierignore`

- [ ] **Step 1: Write `.prettierrc`**

```json
{
  "printWidth": 100,
  "singleQuote": false,
  "trailingComma": "all",
  "semi": true
}
```

- [ ] **Step 2: Write `.prettierignore`**

```
node_modules/
package-lock.json
docs/superpowers/specs/
docs/superpowers/plans/
*.md
```

(We exclude `*.md` because Prettier's markdown reflow is aggressive and the spec/plan markdown is hand-formatted for readability. We can revisit later.)

- [ ] **Step 3: Run format:check**

Run: `npm run format:check`
Expected: `All matched files use Prettier code style!` (or equivalent success message). If any file is mis-formatted, run `npm run format` to fix it, then verify with `format:check` again.

- [ ] **Step 4: Commit**

```bash
git add .prettierrc .prettierignore
git commit -m "Add Prettier configuration"
```

---

### Task 4: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  format:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run format:check
      - name: shellcheck hooks
        run: |
          if compgen -G "hooks/*" > /dev/null; then
            shellcheck $(find hooks -type f ! -name "*.cmd" ! -name "*.json")
          else
            echo "No hooks yet, skipping shellcheck."
          fi

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "Add CI workflow with format and test jobs"
```

- [ ] **Step 3: Verify CI runs after first PR is opened**

When the plan's PR is opened (see "Execution handoff" at end of plan), confirm both jobs pass on GitHub Actions.

---

### Task 5: Directory skeleton

**Files:**
- Create: empty directories under `lib/`, `skills/`, `hooks/`, `test/`

- [ ] **Step 1: Create directories with placeholder `.gitkeep` files**

Run:

```bash
mkdir -p lib/config lib/entries lib/promote lib/reports lib/hooks
mkdir -p skills/setup skills/record skills/promote skills/report
mkdir -p hooks
mkdir -p test/config test/entries test/promote test/reports test/hooks test/helpers
touch lib/config/.gitkeep lib/entries/.gitkeep lib/promote/.gitkeep lib/reports/.gitkeep lib/hooks/.gitkeep
touch skills/setup/.gitkeep skills/record/.gitkeep skills/promote/.gitkeep skills/report/.gitkeep
touch hooks/.gitkeep
touch test/config/.gitkeep test/entries/.gitkeep test/promote/.gitkeep test/reports/.gitkeep test/hooks/.gitkeep test/helpers/.gitkeep
```

- [ ] **Step 2: Commit**

```bash
git add lib/ skills/ hooks/ test/
git commit -m "Add directory skeleton for lib, skills, hooks, test"
```

(As each `.gitkeep` is replaced by real files in later tasks, `git rm` it then.)

---

## Section 2 — Config layer

### Task 6: tmp directory test helper

**Files:**
- Create: `test/helpers/tmp.js`
- Create: `test/helpers/tmp.test.js`

- [ ] **Step 1: Write the test**

```javascript
// test/helpers/tmp.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, writeFileSync, rmSync } from "node:fs";
import { withTmpDir } from "./tmp.js";

test("withTmpDir creates a unique directory and removes it after", async () => {
  let capturedPath = null;
  await withTmpDir(async (dir) => {
    capturedPath = dir;
    assert.ok(existsSync(dir));
    assert.ok(statSync(dir).isDirectory());
    writeFileSync(`${dir}/sample.txt`, "hello");
    assert.ok(existsSync(`${dir}/sample.txt`));
  });
  assert.ok(capturedPath !== null);
  assert.equal(existsSync(capturedPath), false);
});

test("withTmpDir cleans up even when callback throws", async () => {
  let capturedPath = null;
  await assert.rejects(
    withTmpDir(async (dir) => {
      capturedPath = dir;
      throw new Error("boom");
    }),
    /boom/,
  );
  assert.equal(existsSync(capturedPath), false);
});
```

- [ ] **Step 2: Run the test to confirm failure**

Run: `npm test`
Expected: FAIL — `withTmpDir` import error (module not found).

- [ ] **Step 3: Implement `withTmpDir`**

```javascript
// test/helpers/tmp.js
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Run an async callback with a fresh temporary directory.
 * The directory is removed afterward, even if the callback throws.
 *
 * @template T
 * @param {(dir: string) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTmpDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "archievement-test-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: Run the test to confirm pass**

Run: `npm test`
Expected: PASS — both `withTmpDir` tests plus the sanity test.

- [ ] **Step 5: Remove `.gitkeep` for `test/helpers/` and commit**

```bash
git rm test/helpers/.gitkeep
git add test/helpers/tmp.js test/helpers/tmp.test.js
git commit -m "Add tmp directory test helper"
```

---

### Task 7: `lib/config/global.js`

**Files:**
- Create: `lib/config/global.js`
- Create: `test/config/global.test.js`

`global.yml` holds `default_language`, `stale_days`, `archievement_root`.

- [ ] **Step 1: Write the test**

```javascript
// test/config/global.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import { readGlobalConfig, writeGlobalConfig, DEFAULT_GLOBAL_CONFIG } from "../../lib/config/global.js";

test("readGlobalConfig returns defaults when file is missing", async () => {
  await withTmpDir(async (dir) => {
    const cfg = readGlobalConfig(join(dir, "missing.yml"));
    assert.deepEqual(cfg, DEFAULT_GLOBAL_CONFIG);
  });
});

test("readGlobalConfig parses an existing file and merges with defaults", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "global.yml");
    writeFileSync(path, "default_language: fr\nstale_days: 30\n");
    const cfg = readGlobalConfig(path);
    assert.equal(cfg.default_language, "fr");
    assert.equal(cfg.stale_days, 30);
    assert.equal(cfg.archievement_root, DEFAULT_GLOBAL_CONFIG.archievement_root);
  });
});

test("writeGlobalConfig writes a YAML file that round-trips", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "global.yml");
    const input = { default_language: "zh", stale_days: 21, archievement_root: "~/archievement" };
    writeGlobalConfig(path, input);
    const cfg = readGlobalConfig(path);
    assert.deepEqual(cfg, input);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/config/global.js`**

```javascript
// lib/config/global.js
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import yaml from "js-yaml";

export const DEFAULT_GLOBAL_CONFIG = Object.freeze({
  default_language: "en",
  stale_days: 21,
  archievement_root: "~/archievement",
});

/**
 * Read the global config YAML file. Returns defaults merged with any present
 * file contents. Missing file => defaults.
 *
 * @param {string} path Absolute path to global.yml
 * @returns {{ default_language: string, stale_days: number, archievement_root: string }}
 */
export function readGlobalConfig(path) {
  if (!existsSync(path)) {
    return { ...DEFAULT_GLOBAL_CONFIG };
  }
  const parsed = yaml.load(readFileSync(path, "utf8")) ?? {};
  return { ...DEFAULT_GLOBAL_CONFIG, ...parsed };
}

/**
 * Write the global config YAML file. Creates the parent directory if needed.
 *
 * @param {string} path
 * @param {{ default_language: string, stale_days: number, archievement_root: string }} config
 */
export function writeGlobalConfig(path, config) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, yaml.dump(config), "utf8");
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS — all global config tests.

- [ ] **Step 5: Commit**

```bash
git rm lib/config/.gitkeep test/config/.gitkeep
git add lib/config/global.js test/config/global.test.js
git commit -m "Add global config reader and writer"
```

---

### Task 8: `lib/config/projects.js`

**Files:**
- Create: `lib/config/projects.js`
- Create: `test/config/projects.test.js`

`projects.yml` holds `projects[]` (each with `match`, `slug`, `category`, optional `language`) and `ignore[]` (each with `match`).

- [ ] **Step 1: Write the test**

```javascript
// test/config/projects.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import {
  readProjectsConfig,
  writeProjectsConfig,
  matchProject,
  addProject,
  addIgnore,
} from "../../lib/config/projects.js";

test("readProjectsConfig returns empty when file missing", async () => {
  await withTmpDir(async (dir) => {
    const cfg = readProjectsConfig(join(dir, "missing.yml"));
    assert.deepEqual(cfg, { projects: [], ignore: [] });
  });
});

test("matchProject finds entry by git-remote", async () => {
  const cfg = {
    projects: [
      {
        match: { type: "git-remote", url: "github.com/me/project-a" },
        slug: "project-a",
        category: "work",
        language: "en",
      },
    ],
    ignore: [],
  };
  const hit = matchProject(cfg, { remote: "github.com/me/project-a", cwd: "/tmp/whatever" });
  assert.equal(hit.kind, "match");
  assert.equal(hit.project.slug, "project-a");
});

test("matchProject finds entry by absolute path when no git remote", async () => {
  const cfg = {
    projects: [
      {
        match: { type: "path", path: "/Users/foo/work/no-git-project" },
        slug: "no-git-project",
        category: "personal",
      },
    ],
    ignore: [],
  };
  const hit = matchProject(cfg, { remote: null, cwd: "/Users/foo/work/no-git-project" });
  assert.equal(hit.kind, "match");
  assert.equal(hit.project.slug, "no-git-project");
});

test("matchProject reports 'ignored' when cwd is in ignore list", async () => {
  const cfg = {
    projects: [],
    ignore: [{ match: { type: "path", path: "/tmp/ignored" } }],
  };
  const hit = matchProject(cfg, { remote: null, cwd: "/tmp/ignored" });
  assert.equal(hit.kind, "ignored");
});

test("matchProject reports 'unknown' when nothing matches", async () => {
  const cfg = { projects: [], ignore: [] };
  const hit = matchProject(cfg, { remote: "github.com/me/new", cwd: "/tmp/new" });
  assert.equal(hit.kind, "unknown");
});

test("addProject appends and writeProjectsConfig round-trips", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "projects.yml");
    let cfg = readProjectsConfig(path);
    cfg = addProject(cfg, {
      match: { type: "git-remote", url: "github.com/me/new" },
      slug: "new",
      category: "work",
    });
    writeProjectsConfig(path, cfg);
    const reloaded = readProjectsConfig(path);
    assert.equal(reloaded.projects.length, 1);
    assert.equal(reloaded.projects[0].slug, "new");
  });
});

test("addIgnore appends to ignore list", () => {
  const cfg = { projects: [], ignore: [] };
  const next = addIgnore(cfg, { match: { type: "path", path: "/tmp/x" } });
  assert.equal(next.ignore.length, 1);
  assert.equal(next.ignore[0].match.path, "/tmp/x");
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/config/projects.js`**

```javascript
// lib/config/projects.js
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import yaml from "js-yaml";

const EMPTY = Object.freeze({ projects: [], ignore: [] });

/**
 * @typedef {{ type: "git-remote", url: string } | { type: "path", path: string }} Matcher
 * @typedef {{ match: Matcher, slug: string, category: "work" | "personal", language?: string }} ProjectEntry
 * @typedef {{ match: Matcher }} IgnoreEntry
 * @typedef {{ projects: ProjectEntry[], ignore: IgnoreEntry[] }} ProjectsConfig
 * @typedef {{ remote: string | null, cwd: string }} Probe
 * @typedef {{ kind: "match", project: ProjectEntry } | { kind: "ignored" } | { kind: "unknown" }} MatchResult
 */

/**
 * @param {string} path
 * @returns {ProjectsConfig}
 */
export function readProjectsConfig(path) {
  if (!existsSync(path)) {
    return { projects: [], ignore: [] };
  }
  const parsed = yaml.load(readFileSync(path, "utf8")) ?? {};
  return {
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    ignore: Array.isArray(parsed.ignore) ? parsed.ignore : [],
  };
}

/**
 * @param {string} path
 * @param {ProjectsConfig} config
 */
export function writeProjectsConfig(path, config) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, yaml.dump(config), "utf8");
}

/**
 * @param {ProjectsConfig} config
 * @param {Probe} probe
 * @returns {MatchResult}
 */
export function matchProject(config, probe) {
  for (const proj of config.projects) {
    if (matcherMatches(proj.match, probe)) {
      return { kind: "match", project: proj };
    }
  }
  for (const ig of config.ignore) {
    if (matcherMatches(ig.match, probe)) {
      return { kind: "ignored" };
    }
  }
  return { kind: "unknown" };
}

/**
 * @param {Matcher} matcher
 * @param {Probe} probe
 */
function matcherMatches(matcher, probe) {
  if (matcher.type === "git-remote") {
    return probe.remote !== null && matcher.url === probe.remote;
  }
  if (matcher.type === "path") {
    return matcher.path === probe.cwd;
  }
  return false;
}

/**
 * @param {ProjectsConfig} config
 * @param {ProjectEntry} entry
 * @returns {ProjectsConfig}
 */
export function addProject(config, entry) {
  return { ...config, projects: [...config.projects, entry] };
}

/**
 * @param {ProjectsConfig} config
 * @param {IgnoreEntry} entry
 * @returns {ProjectsConfig}
 */
export function addIgnore(config, entry) {
  return { ...config, ignore: [...config.ignore, entry] };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS — all projects-config tests.

- [ ] **Step 5: Commit**

```bash
git add lib/config/projects.js test/config/projects.test.js
git commit -m "Add projects config reader, writer, and matcher"
```

---

### Task 9: `lib/config/user-prefs.js`

**Files:**
- Create: `lib/config/user-prefs.js`
- Create: `test/config/user-prefs.test.js`

`user-prefs.yml` is small — currently just `languages_known: [zh, en]`. Future fields will land here too.

- [ ] **Step 1: Write the test**

```javascript
// test/config/user-prefs.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import {
  readUserPrefs,
  writeUserPrefs,
  rememberLanguage,
  DEFAULT_USER_PREFS,
} from "../../lib/config/user-prefs.js";

test("readUserPrefs returns defaults when file missing", async () => {
  await withTmpDir(async (dir) => {
    const prefs = readUserPrefs(join(dir, "missing.yml"));
    assert.deepEqual(prefs, DEFAULT_USER_PREFS);
  });
});

test("rememberLanguage appends without duplicating", () => {
  const start = { languages_known: ["zh"] };
  const after = rememberLanguage(start, "en");
  assert.deepEqual(after.languages_known, ["zh", "en"]);
  const again = rememberLanguage(after, "zh");
  assert.deepEqual(again.languages_known, ["zh", "en"]);
});

test("writeUserPrefs round-trips", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "user-prefs.yml");
    writeUserPrefs(path, { languages_known: ["zh", "en"] });
    const reloaded = readUserPrefs(path);
    assert.deepEqual(reloaded.languages_known, ["zh", "en"]);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/config/user-prefs.js`**

```javascript
// lib/config/user-prefs.js
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import yaml from "js-yaml";

export const DEFAULT_USER_PREFS = Object.freeze({
  languages_known: [],
});

/**
 * @param {string} path
 * @returns {{ languages_known: string[] }}
 */
export function readUserPrefs(path) {
  if (!existsSync(path)) {
    return { ...DEFAULT_USER_PREFS, languages_known: [] };
  }
  const parsed = yaml.load(readFileSync(path, "utf8")) ?? {};
  return {
    languages_known: Array.isArray(parsed.languages_known) ? parsed.languages_known : [],
  };
}

/**
 * @param {string} path
 * @param {{ languages_known: string[] }} prefs
 */
export function writeUserPrefs(path, prefs) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, yaml.dump(prefs), "utf8");
}

/**
 * Append a language code to languages_known if not already present.
 * Pure: returns a new object.
 *
 * @param {{ languages_known: string[] }} prefs
 * @param {string} lang
 * @returns {{ languages_known: string[] }}
 */
export function rememberLanguage(prefs, lang) {
  if (prefs.languages_known.includes(lang)) {
    return prefs;
  }
  return { ...prefs, languages_known: [...prefs.languages_known, lang] };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/config/user-prefs.js test/config/user-prefs.test.js
git commit -m "Add user prefs reader, writer, and language tracker"
```

---

### Task 10: `lib/git.js` — remote detection + normalization

**Files:**
- Create: `lib/git.js`
- Create: `test/git.test.js`

- [ ] **Step 1: Write the test**

```javascript
// test/git.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { withTmpDir } from "./helpers/tmp.js";
import { normalizeGitRemote, getProjectProbe } from "../lib/git.js";

test("normalizeGitRemote handles SSH-style URLs", () => {
  assert.equal(normalizeGitRemote("git@github.com:foo/bar.git"), "github.com/foo/bar");
});

test("normalizeGitRemote handles HTTPS URLs", () => {
  assert.equal(normalizeGitRemote("https://github.com/foo/bar.git"), "github.com/foo/bar");
});

test("normalizeGitRemote strips .git suffix when missing", () => {
  assert.equal(normalizeGitRemote("https://github.com/foo/bar"), "github.com/foo/bar");
});

test("normalizeGitRemote handles trailing slash", () => {
  assert.equal(normalizeGitRemote("https://github.com/foo/bar/"), "github.com/foo/bar");
});

test("normalizeGitRemote returns null for empty/garbage input", () => {
  assert.equal(normalizeGitRemote(""), null);
  assert.equal(normalizeGitRemote(null), null);
});

test("getProjectProbe returns normalized remote inside a git repo", async () => {
  await withTmpDir(async (dir) => {
    execSync("git init", { cwd: dir });
    execSync("git remote add origin git@github.com:me/sample.git", { cwd: dir });
    const probe = getProjectProbe(dir);
    assert.equal(probe.remote, "github.com/me/sample");
    assert.equal(probe.cwd, dir);
  });
});

test("getProjectProbe returns null remote outside a git repo", async () => {
  await withTmpDir(async (dir) => {
    const probe = getProjectProbe(dir);
    assert.equal(probe.remote, null);
    assert.equal(probe.cwd, dir);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/git.js`**

```javascript
// lib/git.js
import { execSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * Normalize a git remote URL to a canonical form.
 *
 * Handles:
 *   git@github.com:foo/bar.git    → github.com/foo/bar
 *   https://github.com/foo/bar.git → github.com/foo/bar
 *
 * @param {string | null | undefined} url
 * @returns {string | null}
 */
export function normalizeGitRemote(url) {
  if (!url || typeof url !== "string") return null;
  let s = url.trim();
  if (!s) return null;

  // strip protocol or SSH prefix
  s = s.replace(/^[a-z]+:\/\//i, "");
  s = s.replace(/^git@/, "");

  // SSH form host:path → host/path
  s = s.replace(/^([^:/]+):/, "$1/");

  // strip trailing slash, then trailing .git
  s = s.replace(/\/+$/, "");
  s = s.replace(/\.git$/, "");

  return s || null;
}

/**
 * Inspect a directory and return a probe that the projects.js matcher can use.
 *
 * @param {string} cwd Absolute path to the directory being probed.
 * @returns {{ remote: string | null, cwd: string }}
 */
export function getProjectProbe(cwd) {
  const absCwd = resolve(cwd);
  let remote = null;
  try {
    const raw = execSync("git remote get-url origin", {
      cwd: absCwd,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    remote = normalizeGitRemote(raw);
  } catch {
    remote = null;
  }
  return { remote, cwd: absCwd };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/git.js test/git.test.js
git commit -m "Add git remote detection and URL normalization"
```

---

## Section 3 — Entry layer

### Task 11: `lib/frontmatter.js` — read/write/update YAML frontmatter

**Files:**
- Create: `lib/frontmatter.js`
- Create: `test/frontmatter.test.js`

`gray-matter` is the underlying parser. We wrap it so callers depend on our own API, not the dependency directly.

- [ ] **Step 1: Write the test**

```javascript
// test/frontmatter.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import { withTmpDir } from "./helpers/tmp.js";
import {
  readFrontmatter,
  writeFrontmatter,
  updateFrontmatter,
  appendBody,
} from "../lib/frontmatter.js";

test("readFrontmatter returns frontmatter and body separately", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "entry.md");
    writeFileSync(
      path,
      "---\ncategory: work\nstatus: todo\n---\n\n# Title\n\nBody text.\n",
    );
    const { data, body } = readFrontmatter(path);
    assert.equal(data.category, "work");
    assert.equal(data.status, "todo");
    assert.match(body, /Body text/);
  });
});

test("readFrontmatter on file with no frontmatter returns empty data and full body", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "plain.md");
    writeFileSync(path, "# Just markdown\n\nNo frontmatter.\n");
    const { data, body } = readFrontmatter(path);
    assert.deepEqual(data, {});
    assert.match(body, /Just markdown/);
  });
});

test("writeFrontmatter writes a parseable file", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "out.md");
    writeFrontmatter(path, { category: "personal", status: "in-progress" }, "# Hello\n");
    const { data, body } = readFrontmatter(path);
    assert.equal(data.category, "personal");
    assert.match(body, /# Hello/);
  });
});

test("updateFrontmatter merges fields and preserves body", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "entry.md");
    writeFrontmatter(path, { category: "work", status: "todo" }, "# Title\n\nBody\n");
    updateFrontmatter(path, { status: "in-progress", updated: "2026-05-23" });
    const { data, body } = readFrontmatter(path);
    assert.equal(data.category, "work");
    assert.equal(data.status, "in-progress");
    assert.equal(data.updated, "2026-05-23");
    assert.match(body, /Body/);
  });
});

test("appendBody adds content to the end of the body, preserving frontmatter", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "entry.md");
    writeFrontmatter(path, { category: "work" }, "# Title\n\nOriginal.\n");
    appendBody(path, "\n## 2026-05-23\n\nNew section.\n");
    const { data, body } = readFrontmatter(path);
    assert.equal(data.category, "work");
    assert.match(body, /Original/);
    assert.match(body, /New section/);
    // order: original then new
    assert.ok(body.indexOf("Original") < body.indexOf("New section"));
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/frontmatter.js`**

```javascript
// lib/frontmatter.js
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import matter from "gray-matter";

/**
 * @typedef {{ data: Record<string, unknown>, body: string }} ParsedEntry
 */

/**
 * @param {string} path
 * @returns {ParsedEntry}
 */
export function readFrontmatter(path) {
  const raw = readFileSync(path, "utf8");
  const parsed = matter(raw);
  return { data: parsed.data ?? {}, body: parsed.content ?? "" };
}

/**
 * Write a markdown file with given frontmatter data and body.
 *
 * @param {string} path
 * @param {Record<string, unknown>} data
 * @param {string} body
 */
export function writeFrontmatter(path, data, body) {
  mkdirSync(dirname(path), { recursive: true });
  const serialized = matter.stringify(body, data);
  writeFileSync(path, serialized, "utf8");
}

/**
 * Merge new fields into the frontmatter without disturbing the body.
 *
 * @param {string} path
 * @param {Record<string, unknown>} patch
 */
export function updateFrontmatter(path, patch) {
  const { data, body } = readFrontmatter(path);
  writeFrontmatter(path, { ...data, ...patch }, body);
}

/**
 * Append text to the body of a markdown file, keeping frontmatter intact.
 *
 * @param {string} path
 * @param {string} text
 */
export function appendBody(path, text) {
  const { data, body } = readFrontmatter(path);
  writeFrontmatter(path, data, body + text);
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/frontmatter.js test/frontmatter.test.js
git commit -m "Add frontmatter read, write, update, and append helpers"
```

---

### Task 12: `lib/entries/path.js` — canonical entry paths

**Files:**
- Create: `lib/entries/path.js`
- Create: `test/entries/path.test.js`

An "entry pointer" is `{ category, type, id, layout }`. We always know the layout when creating; when locating later, we let `locateEntry` figure out which form exists on disk.

- [ ] **Step 1: Write the test**

```javascript
// test/entries/path.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import { withTmpDir } from "../helpers/tmp.js";
import {
  entryFilePath,
  entryDirPath,
  entryIndexPath,
  locateEntry,
  isDirOnlyType,
} from "../../lib/entries/path.js";

test("entryFilePath returns flat-file form", () => {
  const p = entryFilePath("/tmp/arch", { category: "work", type: "ticketed", id: "PROJ-1" });
  assert.equal(p, "/tmp/arch/work/ticketed/PROJ-1.md");
});

test("entryDirPath returns directory form", () => {
  const p = entryDirPath("/tmp/arch", { category: "work", type: "ticketed", id: "PROJ-1" });
  assert.equal(p, "/tmp/arch/work/ticketed/PROJ-1");
});

test("entryIndexPath returns index.md inside directory form", () => {
  const p = entryIndexPath("/tmp/arch", { category: "work", type: "ticketed", id: "PROJ-1" });
  assert.equal(p, "/tmp/arch/work/ticketed/PROJ-1/index.md");
});

test("isDirOnlyType is true for learning (because it has materials/)", () => {
  assert.equal(isDirOnlyType("learning"), true);
});

test("isDirOnlyType is false for idea (always file)", () => {
  assert.equal(isDirOnlyType("idea"), false);
});

test("locateEntry finds file form when only file exists", async () => {
  await withTmpDir(async (root) => {
    const target = join(root, "work", "ticketed", "PROJ-1.md");
    mkdirSync(join(root, "work", "ticketed"), { recursive: true });
    writeFileSync(target, "---\ncategory: work\n---\n");
    const located = locateEntry(root, { category: "work", type: "ticketed", id: "PROJ-1" });
    assert.equal(located.layout, "file");
    assert.equal(located.path, target);
  });
});

test("locateEntry finds dir form when only directory exists", async () => {
  await withTmpDir(async (root) => {
    const dir = join(root, "work", "ticketed", "PROJ-2");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.md"), "---\ncategory: work\n---\n");
    const located = locateEntry(root, { category: "work", type: "ticketed", id: "PROJ-2" });
    assert.equal(located.layout, "dir");
    assert.equal(located.path, join(dir, "index.md"));
  });
});

test("locateEntry returns null when neither exists", async () => {
  await withTmpDir(async (root) => {
    const located = locateEntry(root, { category: "work", type: "ticketed", id: "GONE" });
    assert.equal(located, null);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/entries/path.js`**

```javascript
// lib/entries/path.js
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * @typedef {"work" | "personal"} Category
 * @typedef {"ticketed" | "unticketed" | "learning" | "idea"} EntryType
 * @typedef {{ category: Category, type: EntryType, id: string }} EntryPointer
 * @typedef {"file" | "dir"} Layout
 * @typedef {{ layout: Layout, path: string }} LocatedEntry
 */

/**
 * Returns the file-layout path for an entry (without checking existence).
 *
 * @param {string} root archievement_root absolute path
 * @param {EntryPointer} ptr
 * @returns {string}
 */
export function entryFilePath(root, ptr) {
  return join(root, ptr.category, ptr.type, `${ptr.id}.md`);
}

/**
 * Returns the dir-layout directory path for an entry (without checking existence).
 *
 * @param {string} root
 * @param {EntryPointer} ptr
 * @returns {string}
 */
export function entryDirPath(root, ptr) {
  return join(root, ptr.category, ptr.type, ptr.id);
}

/**
 * Returns the dir-layout index.md path.
 *
 * @param {string} root
 * @param {EntryPointer} ptr
 * @returns {string}
 */
export function entryIndexPath(root, ptr) {
  return join(entryDirPath(root, ptr), "index.md");
}

/**
 * Some types are best modeled as directories because they normally
 * accumulate sub-files (materials/, etc.). This is just a hint for create.js.
 *
 * @param {EntryType} type
 */
export function isDirOnlyType(type) {
  return type === "learning";
}

/**
 * Locate an existing entry on disk. Returns null if neither file nor dir form exists.
 *
 * @param {string} root
 * @param {EntryPointer} ptr
 * @returns {LocatedEntry | null}
 */
export function locateEntry(root, ptr) {
  const filePath = entryFilePath(root, ptr);
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    return { layout: "file", path: filePath };
  }
  const indexPath = entryIndexPath(root, ptr);
  if (existsSync(indexPath) && statSync(indexPath).isFile()) {
    return { layout: "dir", path: indexPath };
  }
  return null;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git rm lib/entries/.gitkeep test/entries/.gitkeep
git add lib/entries/path.js test/entries/path.test.js
git commit -m "Add entry path resolution helpers"
```

---

### Task 13: `lib/entries/create.js`

**Files:**
- Create: `lib/entries/create.js`
- Create: `test/entries/create.test.js`

`createEntry(root, ptr, frontmatterExtras, layout, initialBody)` creates a brand-new entry on disk. It refuses to overwrite an existing entry.

- [ ] **Step 1: Write the test**

```javascript
// test/entries/create.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { readFrontmatter } from "../../lib/frontmatter.js";
import { locateEntry, entryFilePath, entryIndexPath } from "../../lib/entries/path.js";

const TODAY = "2026-05-23";

test("createEntry writes a file-layout entry with correct frontmatter", async () => {
  await withTmpDir(async (root) => {
    const result = createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "streaming-md-parser" },
      layout: "file",
      extras: { seed_date: TODAY, tags: ["parser"] },
      body: "Brainstorm: ...\n",
      now: TODAY,
    });
    assert.equal(result.layout, "file");
    assert.equal(result.path, entryFilePath(root, result.pointer));
    const { data, body } = readFrontmatter(result.path);
    assert.equal(data.category, "personal");
    assert.equal(data.type, "idea");
    assert.equal(data.status, "todo");
    assert.equal(data.created, TODAY);
    assert.equal(data.updated, TODAY);
    assert.equal(data.layout, "file");
    assert.equal(data.seed_date, TODAY);
    assert.deepEqual(data.tags, ["parser"]);
    assert.match(body, /Brainstorm/);
  });
});

test("createEntry writes a dir-layout entry with index.md", async () => {
  await withTmpDir(async (root) => {
    const result = createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "PROJ-123" },
      layout: "dir",
      extras: { ticket_id: "PROJ-123", project: "project-a" },
      body: "Overview of PROJ-123.\n",
      now: TODAY,
    });
    assert.equal(result.layout, "dir");
    assert.equal(result.path, entryIndexPath(root, result.pointer));
    const located = locateEntry(root, result.pointer);
    assert.equal(located.layout, "dir");
    const { data } = readFrontmatter(located.path);
    assert.equal(data.ticket_id, "PROJ-123");
    assert.equal(data.project, "project-a");
  });
});

test("createEntry refuses to overwrite an existing entry", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "dup" },
      layout: "file",
      extras: {},
      body: "",
      now: TODAY,
    });
    assert.throws(
      () =>
        createEntry(root, {
          pointer: { category: "personal", type: "idea", id: "dup" },
          layout: "file",
          extras: {},
          body: "",
          now: TODAY,
        }),
      /already exists/,
    );
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/entries/create.js`**

```javascript
// lib/entries/create.js
import { writeFrontmatter } from "../frontmatter.js";
import {
  entryFilePath,
  entryIndexPath,
  locateEntry,
} from "./path.js";

/**
 * @typedef {import("./path.js").EntryPointer} EntryPointer
 * @typedef {import("./path.js").Layout} Layout
 *
 * @typedef {{
 *   pointer: EntryPointer,
 *   layout: Layout,
 *   extras: Record<string, unknown>,
 *   body: string,
 *   now: string,           // ISO date string yyyy-mm-dd
 * }} CreateEntryRequest
 *
 * @typedef {{ pointer: EntryPointer, layout: Layout, path: string }} CreateEntryResult
 */

/**
 * Create a brand-new entry. Refuses to overwrite an existing entry on disk.
 *
 * @param {string} root archievement_root absolute path
 * @param {CreateEntryRequest} req
 * @returns {CreateEntryResult}
 */
export function createEntry(root, req) {
  if (locateEntry(root, req.pointer) !== null) {
    throw new Error(
      `Entry already exists: ${req.pointer.category}/${req.pointer.type}/${req.pointer.id}`,
    );
  }
  const data = {
    category: req.pointer.category,
    type: req.pointer.type,
    status: "todo",
    created: req.now,
    updated: req.now,
    layout: req.layout,
    ...req.extras,
  };
  const targetPath =
    req.layout === "file"
      ? entryFilePath(root, req.pointer)
      : entryIndexPath(root, req.pointer);
  writeFrontmatter(targetPath, data, req.body);
  return { pointer: req.pointer, layout: req.layout, path: targetPath };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/entries/create.js test/entries/create.test.js
git commit -m "Add entry creation with file and dir layouts"
```

---

### Task 14: `lib/entries/read.js`

**Files:**
- Create: `lib/entries/read.js`
- Create: `test/entries/read.test.js`

`readEntry(root, ptr)` returns `{ pointer, layout, path, data, body }` or `null` if the entry does not exist.

- [ ] **Step 1: Write the test**

```javascript
// test/entries/read.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { readEntry } from "../../lib/entries/read.js";

const TODAY = "2026-05-23";

test("readEntry returns full entry data for an existing file-layout entry", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "work", type: "idea", id: "foo" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "Initial body.\n",
      now: TODAY,
    });
    const entry = readEntry(root, { category: "work", type: "idea", id: "foo" });
    assert.equal(entry.layout, "file");
    assert.equal(entry.data.category, "work");
    assert.equal(entry.data.type, "idea");
    assert.equal(entry.data.status, "todo");
    assert.match(entry.body, /Initial body/);
  });
});

test("readEntry returns null when entry is missing", async () => {
  await withTmpDir(async (root) => {
    const entry = readEntry(root, { category: "work", type: "ticketed", id: "GONE" });
    assert.equal(entry, null);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/entries/read.js`**

```javascript
// lib/entries/read.js
import { readFrontmatter } from "../frontmatter.js";
import { locateEntry } from "./path.js";

/**
 * @typedef {import("./path.js").EntryPointer} EntryPointer
 * @typedef {import("./path.js").Layout} Layout
 * @typedef {{
 *   pointer: EntryPointer,
 *   layout: Layout,
 *   path: string,
 *   data: Record<string, unknown>,
 *   body: string,
 * }} EntryView
 */

/**
 * @param {string} root
 * @param {EntryPointer} ptr
 * @returns {EntryView | null}
 */
export function readEntry(root, ptr) {
  const located = locateEntry(root, ptr);
  if (!located) return null;
  const { data, body } = readFrontmatter(located.path);
  return { pointer: ptr, layout: located.layout, path: located.path, data, body };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/entries/read.js test/entries/read.test.js
git commit -m "Add entry read helper"
```

---

### Task 15: `lib/entries/update.js`

**Files:**
- Create: `lib/entries/update.js`
- Create: `test/entries/update.test.js`

This module exposes three operations: `updateEntryFrontmatter`, `appendToDoc`, and `writeSiblingDoc`. The last two only apply to dir-layout entries.

- [ ] **Step 1: Write the test**

```javascript
// test/entries/update.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { readEntry } from "../../lib/entries/read.js";
import {
  updateEntryFrontmatter,
  appendToDoc,
  writeSiblingDoc,
} from "../../lib/entries/update.js";

const TODAY = "2026-05-23";
const TOMORROW = "2026-05-24";

test("updateEntryFrontmatter changes status and updated date", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "PROJ-1" },
      layout: "dir",
      extras: { ticket_id: "PROJ-1", project: "project-a" },
      body: "",
      now: TODAY,
    });
    updateEntryFrontmatter(root, created.pointer, { status: "in-progress", updated: TOMORROW });
    const entry = readEntry(root, created.pointer);
    assert.equal(entry.data.status, "in-progress");
    assert.equal(entry.data.updated, TOMORROW);
  });
});

test("appendToDoc creates progress.md and appends to it in dir-layout entry", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "PROJ-2" },
      layout: "dir",
      extras: { ticket_id: "PROJ-2", project: "project-a" },
      body: "",
      now: TODAY,
    });
    appendToDoc(root, created.pointer, "progress", "## 2026-05-23\n\nStarted.\n");
    const dir = dirname(created.path);
    assert.ok(existsSync(join(dir, "progress.md")));
    appendToDoc(root, created.pointer, "progress", "## 2026-05-24\n\nMore work.\n");
    const reread = readEntry(root, created.pointer);
    assert.equal(reread.data.category, "work"); // index.md untouched
  });
});

test("appendToDoc on file-layout entry appends a section to the body", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "thing" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "Initial idea.\n",
      now: TODAY,
    });
    appendToDoc(root, created.pointer, "brainstorm", "\n## 2026-05-23\n\nMore thinking.\n");
    const entry = readEntry(root, created.pointer);
    assert.match(entry.body, /Initial idea/);
    assert.match(entry.body, /More thinking/);
  });
});

test("writeSiblingDoc creates a new file under a dir-layout entry's directory", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "PROJ-3" },
      layout: "dir",
      extras: { ticket_id: "PROJ-3", project: "project-a" },
      body: "",
      now: TODAY,
    });
    writeSiblingDoc(
      root,
      created.pointer,
      "pr-summaries/2026-05-15-pr-456.md",
      "# PR 456\n\nSummary.\n",
    );
    const dir = dirname(created.path);
    assert.ok(existsSync(join(dir, "pr-summaries", "2026-05-15-pr-456.md")));
  });
});

test("writeSiblingDoc throws when called on a file-layout entry", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "flat" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "",
      now: TODAY,
    });
    assert.throws(
      () => writeSiblingDoc(root, created.pointer, "extra.md", "x"),
      /file-layout/,
    );
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/entries/update.js`**

```javascript
// lib/entries/update.js
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  appendBody,
  updateFrontmatter,
} from "../frontmatter.js";
import { entryDirPath, locateEntry } from "./path.js";

/**
 * @typedef {import("./path.js").EntryPointer} EntryPointer
 */

/**
 * @param {string} root
 * @param {EntryPointer} ptr
 * @param {Record<string, unknown>} patch
 */
export function updateEntryFrontmatter(root, ptr, patch) {
  const located = locateEntry(root, ptr);
  if (!located) {
    throw new Error(`Entry not found: ${ptr.category}/${ptr.type}/${ptr.id}`);
  }
  updateFrontmatter(located.path, patch);
}

/**
 * Append a markdown section to a named doc within an entry.
 *
 * For dir-layout: write/append to `<entry-dir>/<docName>.md`. If the doc file does
 * not yet exist, create it (no frontmatter — sibling docs are plain markdown).
 *
 * For file-layout: docName is ignored; the section is appended directly to the
 * single file's body.
 *
 * @param {string} root
 * @param {EntryPointer} ptr
 * @param {string} docName  e.g. "progress", "brainstorm", "plan"
 * @param {string} text     markdown to append (caller ensures leading newline)
 */
export function appendToDoc(root, ptr, docName, text) {
  const located = locateEntry(root, ptr);
  if (!located) {
    throw new Error(`Entry not found: ${ptr.category}/${ptr.type}/${ptr.id}`);
  }
  if (located.layout === "file") {
    appendBody(located.path, text);
    return;
  }
  const dir = entryDirPath(root, ptr);
  const file = join(dir, `${docName}.md`);
  if (existsSync(file)) {
    const current = readFileSync(file, "utf8");
    writeFileSync(file, current + text, "utf8");
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text, "utf8");
  }
}

/**
 * Create a sibling file inside a dir-layout entry (e.g., `pr-summaries/<date>-pr-<n>.md`).
 *
 * @param {string} root
 * @param {EntryPointer} ptr
 * @param {string} relPath path relative to the entry's directory
 * @param {string} content
 */
export function writeSiblingDoc(root, ptr, relPath, content) {
  const located = locateEntry(root, ptr);
  if (!located) {
    throw new Error(`Entry not found: ${ptr.category}/${ptr.type}/${ptr.id}`);
  }
  if (located.layout !== "dir") {
    throw new Error(
      `Cannot write sibling doc on file-layout entry: ${ptr.category}/${ptr.type}/${ptr.id}`,
    );
  }
  const target = join(entryDirPath(root, ptr), relPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/entries/update.js test/entries/update.test.js
git commit -m "Add entry update, append, and sibling-doc helpers"
```

---

### Task 16: `lib/entries/list.js`

**Files:**
- Create: `lib/entries/list.js`
- Create: `test/entries/list.test.js`

`listEntries(root, filters)` walks the tree and returns matching entries' `{ pointer, layout, data }` (without bodies, for performance). Filters: `category`, `type`, `status`, `project`, `updatedSince`, `updatedUntil`.

- [ ] **Step 1: Write the test**

```javascript
// test/entries/list.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { updateEntryFrontmatter } from "../../lib/entries/update.js";
import { listEntries } from "../../lib/entries/list.js";

const DATE = (d) => `2026-05-${String(d).padStart(2, "0")}`;

async function seed(root) {
  createEntry(root, {
    pointer: { category: "work", type: "ticketed", id: "PROJ-1" },
    layout: "dir",
    extras: { ticket_id: "PROJ-1", project: "project-a" },
    body: "",
    now: DATE(1),
  });
  createEntry(root, {
    pointer: { category: "work", type: "ticketed", id: "PROJ-2" },
    layout: "file",
    extras: { ticket_id: "PROJ-2", project: "project-a" },
    body: "",
    now: DATE(2),
  });
  createEntry(root, {
    pointer: { category: "personal", type: "idea", id: "spark" },
    layout: "file",
    extras: { seed_date: DATE(3) },
    body: "",
    now: DATE(3),
  });
  updateEntryFrontmatter(
    root,
    { category: "work", type: "ticketed", id: "PROJ-2" },
    { status: "in-progress", updated: DATE(10) },
  );
  updateEntryFrontmatter(
    root,
    { category: "personal", type: "idea", id: "spark" },
    { status: "done", updated: DATE(20) },
  );
}

test("listEntries returns all entries when no filter", async () => {
  await withTmpDir(async (root) => {
    await seed(root);
    const all = listEntries(root, {});
    assert.equal(all.length, 3);
  });
});

test("listEntries filters by category", async () => {
  await withTmpDir(async (root) => {
    await seed(root);
    const work = listEntries(root, { category: "work" });
    assert.equal(work.length, 2);
    const personal = listEntries(root, { category: "personal" });
    assert.equal(personal.length, 1);
  });
});

test("listEntries filters by type", async () => {
  await withTmpDir(async (root) => {
    await seed(root);
    const tickets = listEntries(root, { type: "ticketed" });
    assert.equal(tickets.length, 2);
    const ideas = listEntries(root, { type: "idea" });
    assert.equal(ideas.length, 1);
  });
});

test("listEntries filters by status", async () => {
  await withTmpDir(async (root) => {
    await seed(root);
    const todo = listEntries(root, { status: "todo" });
    assert.equal(todo.length, 1);
    assert.equal(todo[0].pointer.id, "PROJ-1");
    const done = listEntries(root, { status: "done" });
    assert.equal(done.length, 1);
    assert.equal(done[0].pointer.id, "spark");
  });
});

test("listEntries filters by updatedSince", async () => {
  await withTmpDir(async (root) => {
    await seed(root);
    const recent = listEntries(root, { updatedSince: DATE(15) });
    assert.equal(recent.length, 1);
    assert.equal(recent[0].pointer.id, "spark");
  });
});

test("listEntries filters by project", async () => {
  await withTmpDir(async (root) => {
    await seed(root);
    const a = listEntries(root, { project: "project-a" });
    assert.equal(a.length, 2);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/entries/list.js`**

```javascript
// lib/entries/list.js
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { readFrontmatter } from "../frontmatter.js";

/**
 * @typedef {import("./path.js").EntryPointer} EntryPointer
 * @typedef {import("./path.js").Layout} Layout
 * @typedef {import("./path.js").Category} Category
 * @typedef {import("./path.js").EntryType} EntryType
 *
 * @typedef {{
 *   category?: Category,
 *   type?: EntryType,
 *   status?: "todo" | "in-progress" | "done",
 *   project?: string,
 *   updatedSince?: string,
 *   updatedUntil?: string,
 * }} ListFilters
 *
 * @typedef {{ pointer: EntryPointer, layout: Layout, path: string, data: Record<string, unknown> }} EntrySummary
 */

const CATEGORIES = ["work", "personal"];
const TYPES = ["ticketed", "unticketed", "learning", "idea"];

/**
 * @param {string} root
 * @param {ListFilters} filters
 * @returns {EntrySummary[]}
 */
export function listEntries(root, filters = {}) {
  const out = [];
  for (const category of CATEGORIES) {
    if (filters.category && filters.category !== category) continue;
    for (const type of TYPES) {
      if (filters.type && filters.type !== type) continue;
      const typeDir = join(root, category, type);
      if (!existsSync(typeDir)) continue;
      for (const name of readdirSync(typeDir)) {
        const childPath = join(typeDir, name);
        const childStat = statSync(childPath);
        let layout, indexFile, id;
        if (childStat.isDirectory()) {
          indexFile = join(childPath, "index.md");
          if (!existsSync(indexFile)) continue;
          layout = "dir";
          id = name;
        } else if (childStat.isFile() && name.endsWith(".md")) {
          indexFile = childPath;
          layout = "file";
          id = name.slice(0, -3);
        } else {
          continue;
        }
        const { data } = readFrontmatter(indexFile);
        if (!matchesFilters(data, filters)) continue;
        out.push({
          pointer: { category, type, id },
          layout,
          path: indexFile,
          data,
        });
      }
    }
  }
  return out;
}

function matchesFilters(data, filters) {
  if (filters.status && data.status !== filters.status) return false;
  if (filters.project && data.project !== filters.project) return false;
  if (filters.updatedSince && (data.updated ?? "") < filters.updatedSince) return false;
  if (filters.updatedUntil && (data.updated ?? "") > filters.updatedUntil) return false;
  return true;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/entries/list.js test/entries/list.test.js
git commit -m "Add entry listing with filters"
```

---

## Section 4 — Promotion

> **Superseded (2026-05-29):** the `promoted_from`/`promoted_to` audit-link behavior described in this section was replaced by the *graduate* model — promote now copies content then **deletes** the source, preserving the slug, and writes no audit links. See [`2026-05-29-graduate-promote-slug-identity.md`](2026-05-29-graduate-promote-slug-identity.md) for the current design. This section is retained as a historical record of the original build.

### Task 17: `lib/promote/expand.js` — file → dir expansion

**Files:**
- Create: `lib/promote/expand.js`
- Create: `test/promote/expand.test.js`

`expandFileToDir(root, ptr)` converts an existing file-layout entry to dir-layout: the file becomes `<id>/index.md`, frontmatter `layout` flips to `"dir"`.

- [ ] **Step 1: Write the test**

```javascript
// test/promote/expand.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { expandFileToDir } from "../../lib/promote/expand.js";
import { readEntry } from "../../lib/entries/read.js";
import { entryFilePath, entryIndexPath } from "../../lib/entries/path.js";

const TODAY = "2026-05-23";

test("expandFileToDir converts file-layout entry to dir-layout", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "convert-me" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "# Title\n\nBody here.\n",
      now: TODAY,
    });
    const ptr = created.pointer;
    expandFileToDir(root, ptr);
    assert.equal(existsSync(entryFilePath(root, ptr)), false);
    assert.equal(existsSync(entryIndexPath(root, ptr)), true);
    const reread = readEntry(root, ptr);
    assert.equal(reread.layout, "dir");
    assert.equal(reread.data.layout, "dir");
    assert.match(reread.body, /Body here/);
  });
});

test("expandFileToDir is a no-op for an already-dir entry", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "PROJ-9" },
      layout: "dir",
      extras: { ticket_id: "PROJ-9", project: "project-a" },
      body: "Already a dir.\n",
      now: TODAY,
    });
    expandFileToDir(root, created.pointer); // should not throw
    const entry = readEntry(root, created.pointer);
    assert.equal(entry.layout, "dir");
  });
});

test("expandFileToDir throws when entry does not exist", async () => {
  await withTmpDir(async (root) => {
    assert.throws(
      () =>
        expandFileToDir(root, { category: "work", type: "ticketed", id: "MISSING" }),
      /not found/,
    );
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/promote/expand.js`**

```javascript
// lib/promote/expand.js
import { unlinkSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { readEntry } from "../entries/read.js";
import { writeFrontmatter } from "../frontmatter.js";
import {
  entryFilePath,
  entryIndexPath,
  locateEntry,
} from "../entries/path.js";

/**
 * @typedef {import("../entries/path.js").EntryPointer} EntryPointer
 */

/**
 * Convert a file-layout entry to dir-layout. No-op if already dir-layout.
 *
 * @param {string} root
 * @param {EntryPointer} ptr
 */
export function expandFileToDir(root, ptr) {
  const located = locateEntry(root, ptr);
  if (!located) {
    throw new Error(`Entry not found: ${ptr.category}/${ptr.type}/${ptr.id}`);
  }
  if (located.layout === "dir") return;
  const view = readEntry(root, ptr);
  if (!view) throw new Error(`Entry not found: ${ptr.category}/${ptr.type}/${ptr.id}`);
  const oldPath = entryFilePath(root, ptr);
  const indexPath = entryIndexPath(root, ptr);
  mkdirSync(dirname(indexPath), { recursive: true });
  writeFrontmatter(indexPath, { ...view.data, layout: "dir" }, view.body);
  unlinkSync(oldPath);
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git rm lib/promote/.gitkeep test/promote/.gitkeep
git add lib/promote/expand.js test/promote/expand.test.js
git commit -m "Add file-to-dir layout expansion helper"
```

---

### Task 18: `lib/promote/move.js` — physical move + reciprocal links

**Files:**
- Create: `lib/promote/move.js`
- Create: `test/promote/move.test.js`

`moveEntry(root, from, to)` moves an entry from one `(category, type, id)` to another. It does NOT change layout; that is the caller's job (orchestrate.js may run expand first).

- [ ] **Step 1: Write the test**

```javascript
// test/promote/move.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { readEntry } from "../../lib/entries/read.js";
import { moveEntry } from "../../lib/promote/move.js";
import { entryFilePath, entryDirPath } from "../../lib/entries/path.js";

const TODAY = "2026-05-23";

test("moveEntry moves a file-layout entry and writes reciprocal links", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "spark" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "An idea.\n",
      now: TODAY,
    });
    const from = created.pointer;
    const to = { category: "work", type: "unticketed", id: "spark-poc" };

    moveEntry(root, from, to, { now: TODAY, layout: "file" });

    // source still exists (audit trail) but is done + promoted_to
    assert.ok(existsSync(entryFilePath(root, from)));
    const source = readEntry(root, from);
    assert.equal(source.data.status, "done");
    assert.equal(source.data.promoted_to, "work/unticketed/spark-poc");
    assert.equal(source.data.updated, TODAY);

    // target exists with promoted_from
    const target = readEntry(root, to);
    assert.equal(target.data.category, "work");
    assert.equal(target.data.type, "unticketed");
    assert.equal(target.data.promoted_from, "personal/idea/spark");
    assert.match(target.body, /An idea/);
  });
});

test("moveEntry throws if target already exists", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "src" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "src body",
      now: TODAY,
    });
    createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "DUP" },
      layout: "dir",
      extras: { ticket_id: "DUP", project: "x" },
      body: "dup body",
      now: TODAY,
    });
    assert.throws(
      () =>
        moveEntry(
          root,
          { category: "personal", type: "idea", id: "src" },
          { category: "work", type: "ticketed", id: "DUP" },
          { now: TODAY, layout: "dir" },
        ),
      /already exists/,
    );
  });
});

test("moveEntry preserves the source dir (audit trail) when moving dir-layout entry", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "work", type: "unticketed", id: "research-foo" },
      layout: "dir",
      extras: { project: "project-a", topic: "research foo" },
      body: "Research overview.\n",
      now: TODAY,
    });
    moveEntry(
      root,
      created.pointer,
      { category: "work", type: "ticketed", id: "PROJ-999" },
      { now: TODAY, layout: "dir", extras: { ticket_id: "PROJ-999" } },
    );
    // source dir still exists with status:done + promoted_to
    assert.ok(existsSync(entryDirPath(root, created.pointer)));
    const source = readEntry(root, created.pointer);
    assert.equal(source.data.status, "done");
    assert.equal(source.data.promoted_to, "work/ticketed/PROJ-999");
    const target = readEntry(root, { category: "work", type: "ticketed", id: "PROJ-999" });
    assert.equal(target.data.ticket_id, "PROJ-999");
    assert.equal(target.data.promoted_from, "work/unticketed/research-foo");
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/promote/move.js`**

```javascript
// lib/promote/move.js
import { cpSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { readEntry } from "../entries/read.js";
import { writeFrontmatter, updateFrontmatter } from "../frontmatter.js";
import {
  entryFilePath,
  entryIndexPath,
  entryDirPath,
  locateEntry,
} from "../entries/path.js";

/**
 * @typedef {import("../entries/path.js").EntryPointer} EntryPointer
 * @typedef {import("../entries/path.js").Layout} Layout
 */

/**
 * Move an entry to a new (category, type, id). The source is preserved
 * (audit trail) with `status: done` and a `promoted_to` link. The target
 * gets a `promoted_from` link back to the source.
 *
 * The target's layout is given by `opts.layout`. If the source layout
 * differs and is "file" while target is "dir", caller should run
 * expandFileToDir first.
 *
 * @param {string} root
 * @param {EntryPointer} from
 * @param {EntryPointer} to
 * @param {{ now: string, layout: Layout, extras?: Record<string, unknown> }} opts
 */
export function moveEntry(root, from, to, opts) {
  const sourceLocated = locateEntry(root, from);
  if (!sourceLocated) {
    throw new Error(`Source entry not found: ${pointerKey(from)}`);
  }
  if (locateEntry(root, to) !== null) {
    throw new Error(`Target entry already exists: ${pointerKey(to)}`);
  }
  const source = readEntry(root, from);

  const targetExtras = opts.extras ?? {};
  const targetData = {
    ...source.data,
    category: to.category,
    type: to.type,
    layout: opts.layout,
    promoted_from: pointerKey(from),
    updated: opts.now,
    ...targetExtras,
  };
  delete targetData.promoted_to;

  // For type-specific fields we may need to drop ones that no longer fit.
  // (Generic; orchestrate.js can pre-clean if needed.)

  const targetPath =
    opts.layout === "file"
      ? entryFilePath(root, to)
      : entryIndexPath(root, to);

  if (sourceLocated.layout === "dir" && opts.layout === "dir") {
    // Copy entire source directory to target directory, then overwrite index.md.
    cpSync(entryDirPath(root, from), entryDirPath(root, to), { recursive: true });
    writeFrontmatter(targetPath, targetData, source.body);
  } else if (sourceLocated.layout === "file" && opts.layout === "file") {
    copyFileSync(sourceLocated.path, targetPath);
    writeFrontmatter(targetPath, targetData, source.body);
  } else if (sourceLocated.layout === "file" && opts.layout === "dir") {
    mkdirSync(entryDirPath(root, to), { recursive: true });
    writeFrontmatter(targetPath, targetData, source.body);
  } else {
    throw new Error(
      "Source is dir-layout but target requested file-layout; collapse not supported.",
    );
  }

  // Mark source as done + promoted_to
  updateFrontmatter(sourceLocated.path, {
    status: "done",
    promoted_to: pointerKey(to),
    updated: opts.now,
  });
}

function pointerKey(ptr) {
  return `${ptr.category}/${ptr.type}/${ptr.id}`;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/promote/move.js test/promote/move.test.js
git commit -m "Add promote/move with reciprocal links and audit trail"
```

---

### Task 19: `lib/promote/orchestrate.js` — full promote operation

**Files:**
- Create: `lib/promote/orchestrate.js`
- Create: `test/promote/orchestrate.test.js`

`promote(root, from, to, opts)` runs the complete flow: optionally expand the source if needed, then move. This is what the `promote` skill calls.

- [ ] **Step 1: Write the test**

```javascript
// test/promote/orchestrate.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { readEntry } from "../../lib/entries/read.js";
import { promote } from "../../lib/promote/orchestrate.js";
import { entryIndexPath } from "../../lib/entries/path.js";

const TODAY = "2026-05-23";

test("promote(idea → ticketed) expands file to dir and writes links", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "work", type: "idea", id: "spark" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "Spark of an idea.\n",
      now: TODAY,
    });

    const result = promote(
      root,
      { category: "work", type: "idea", id: "spark" },
      { category: "work", type: "ticketed", id: "PROJ-100" },
      {
        now: TODAY,
        targetLayout: "dir",
        extras: { ticket_id: "PROJ-100", project: "project-a" },
      },
    );

    assert.equal(
      result.target.path,
      entryIndexPath(root, { category: "work", type: "ticketed", id: "PROJ-100" }),
    );
    const target = readEntry(root, { category: "work", type: "ticketed", id: "PROJ-100" });
    assert.equal(target.data.ticket_id, "PROJ-100");
    assert.equal(target.data.promoted_from, "work/idea/spark");
    assert.match(target.body, /Spark of an idea/);
    const source = readEntry(root, { category: "work", type: "idea", id: "spark" });
    assert.equal(source.data.status, "done");
    assert.equal(source.data.promoted_to, "work/ticketed/PROJ-100");
  });
});

test("promote cross-category (personal idea → work ticketed)", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "cross" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "Cross-cat idea.\n",
      now: TODAY,
    });
    promote(
      root,
      { category: "personal", type: "idea", id: "cross" },
      { category: "work", type: "ticketed", id: "PROJ-555" },
      { now: TODAY, targetLayout: "dir", extras: { ticket_id: "PROJ-555", project: "project-a" } },
    );
    const target = readEntry(root, { category: "work", type: "ticketed", id: "PROJ-555" });
    assert.equal(target.data.category, "work");
    assert.equal(target.data.promoted_from, "personal/idea/cross");
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/promote/orchestrate.js`**

```javascript
// lib/promote/orchestrate.js
import { moveEntry } from "./move.js";
import { locateEntry } from "../entries/path.js";

/**
 * @typedef {import("../entries/path.js").EntryPointer} EntryPointer
 * @typedef {import("../entries/path.js").Layout} Layout
 */

/**
 * Promote an entry: move to a new (category, type, id) with reciprocal links.
 * If the target requires a different layout than the source, the move handles
 * the layout conversion.
 *
 * @param {string} root
 * @param {EntryPointer} from
 * @param {EntryPointer} to
 * @param {{ now: string, targetLayout: Layout, extras?: Record<string, unknown> }} opts
 * @returns {{ source: { pointer: EntryPointer }, target: { pointer: EntryPointer, path: string } }}
 */
export function promote(root, from, to, opts) {
  const sourceLocated = locateEntry(root, from);
  if (!sourceLocated) {
    throw new Error(`Source entry not found: ${from.category}/${from.type}/${from.id}`);
  }
  moveEntry(root, from, to, {
    now: opts.now,
    layout: opts.targetLayout,
    extras: opts.extras,
  });
  const targetLocated = locateEntry(root, to);
  return {
    source: { pointer: from },
    target: { pointer: to, path: targetLocated.path },
  };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/promote/orchestrate.js test/promote/orchestrate.test.js
git commit -m "Add promote orchestration combining expand and move"
```

---

## Section 5 — Reports

### Task 20: `lib/reports/stats.js` — deterministic anchor numbers

**Files:**
- Create: `lib/reports/stats.js`
- Create: `test/reports/stats.test.js`

Anchors are deterministic stats: ticket count, PR count, average days from `in-progress` → `done`. These are computed by code (never by LLM) so reports never drift.

For the average days metric we need an entry's transition history. We approximate it by treating `(created, updated)` as `(starts, ends)` when status is `done`. A more precise history could come later from a status-log file, but YAGNI for v1.

- [ ] **Step 1: Write the test**

```javascript
// test/reports/stats.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAnchors } from "../../lib/reports/stats.js";

const entry = (overrides) => ({
  pointer: { category: "work", type: "ticketed", id: overrides.id ?? "X" },
  layout: "dir",
  path: "/dev/null",
  data: {
    category: "work",
    type: "ticketed",
    status: "done",
    created: "2026-04-01",
    updated: "2026-04-08",
    prs: [],
    ...overrides,
  },
});

test("computeAnchors counts tickets closed in range", () => {
  const entries = [
    entry({ id: "A", updated: "2026-04-08" }),
    entry({ id: "B", updated: "2026-04-15" }),
    entry({ id: "C", status: "in-progress", updated: "2026-04-30" }),
  ];
  const anchors = computeAnchors(entries, { from: "2026-04-01", to: "2026-04-30" });
  assert.equal(anchors.ticketsClosed, 2);
});

test("computeAnchors counts PRs across done ticketed entries in range", () => {
  const entries = [
    entry({
      id: "A",
      updated: "2026-04-08",
      prs: [{ id: 1 }, { id: 2 }],
    }),
    entry({
      id: "B",
      updated: "2026-04-15",
      prs: [{ id: 3 }],
    }),
  ];
  const anchors = computeAnchors(entries, { from: "2026-04-01", to: "2026-04-30" });
  assert.equal(anchors.prsMerged, 3);
});

test("computeAnchors computes average days for done tickets only", () => {
  const entries = [
    entry({ id: "A", created: "2026-04-01", updated: "2026-04-08" }), // 7 days
    entry({ id: "B", created: "2026-04-01", updated: "2026-04-11" }), // 10 days
    entry({ id: "C", status: "in-progress", created: "2026-04-01", updated: "2026-04-20" }),
  ];
  const anchors = computeAnchors(entries, { from: "2026-04-01", to: "2026-04-30" });
  assert.equal(anchors.avgDaysToDone, 8.5);
});

test("computeAnchors returns zero stats on empty list", () => {
  const anchors = computeAnchors([], { from: "2026-04-01", to: "2026-04-30" });
  assert.deepEqual(anchors, { ticketsClosed: 0, prsMerged: 0, avgDaysToDone: null });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/reports/stats.js`**

```javascript
// lib/reports/stats.js

/**
 * @typedef {import("../entries/list.js").EntrySummary} EntrySummary
 *
 * @typedef {{
 *   ticketsClosed: number,
 *   prsMerged: number,
 *   avgDaysToDone: number | null,
 * }} Anchors
 *
 * @typedef {{ from: string, to: string }} DateRange
 */

/**
 * @param {EntrySummary[]} entries
 * @param {DateRange} range
 * @returns {Anchors}
 */
export function computeAnchors(entries, range) {
  const inRangeDone = entries.filter(
    (e) =>
      e.data.status === "done" &&
      e.data.type === "ticketed" &&
      (e.data.updated ?? "") >= range.from &&
      (e.data.updated ?? "") <= range.to,
  );
  const ticketsClosed = inRangeDone.length;
  const prsMerged = inRangeDone.reduce(
    (sum, e) => sum + (Array.isArray(e.data.prs) ? e.data.prs.length : 0),
    0,
  );
  const days = inRangeDone
    .map((e) => daysBetween(e.data.created, e.data.updated))
    .filter((d) => d !== null);
  const avgDaysToDone =
    days.length === 0 ? null : roundTo(days.reduce((a, b) => a + b, 0) / days.length, 2);
  return { ticketsClosed, prsMerged, avgDaysToDone };
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  const start = Date.parse(a);
  const end = Date.parse(b);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return (end - start) / (1000 * 60 * 60 * 24);
}

function roundTo(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git rm lib/reports/.gitkeep test/reports/.gitkeep
git add lib/reports/stats.js test/reports/stats.test.js
git commit -m "Add deterministic anchor stats for reports"
```

---

### Task 21: `lib/reports/summary.js` — in-progress snapshot

**Files:**
- Create: `lib/reports/summary.js`
- Create: `test/reports/summary.test.js`

`buildSummary(entries, opts)` returns a markdown body listing every `todo` or `in-progress` entry, grouped by `category × type`. Entries whose `updated` is older than `staleDays` get a `⚠️ stale` marker.

- [ ] **Step 1: Write the test**

```javascript
// test/reports/summary.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSummary } from "../../lib/reports/summary.js";

const entry = (over) => ({
  pointer: { category: over.category ?? "work", type: over.type ?? "ticketed", id: over.id },
  layout: "dir",
  path: "/dev/null",
  data: {
    category: over.category ?? "work",
    type: over.type ?? "ticketed",
    status: over.status ?? "in-progress",
    updated: over.updated,
    ticket_id: over.id,
    ...over.data,
  },
});

test("buildSummary groups entries by category and type", () => {
  const entries = [
    entry({ id: "PROJ-1", updated: "2026-05-22" }),
    entry({ id: "PROJ-2", updated: "2026-05-23" }),
    entry({ category: "personal", type: "idea", status: "todo", id: "spark", updated: "2026-05-20" }),
  ];
  const md = buildSummary(entries, { now: "2026-05-23", staleDays: 21 });
  assert.match(md, /## Work/);
  assert.match(md, /### Ticketed \(2\)/);
  assert.match(md, /PROJ-1/);
  assert.match(md, /PROJ-2/);
  assert.match(md, /## Personal/);
  assert.match(md, /### Ideas \(1\)/);
});

test("buildSummary marks stale entries", () => {
  const entries = [
    entry({ id: "PROJ-FRESH", updated: "2026-05-22" }),
    entry({ id: "PROJ-STALE", updated: "2026-04-01" }),
  ];
  const md = buildSummary(entries, { now: "2026-05-23", staleDays: 21 });
  assert.match(md, /PROJ-FRESH.*1d ago/);
  assert.match(md, /PROJ-STALE.*52d ago.*stale/);
});

test("buildSummary excludes done entries", () => {
  const entries = [
    entry({ id: "PROJ-DONE", status: "done", updated: "2026-05-20" }),
    entry({ id: "PROJ-LIVE", status: "in-progress", updated: "2026-05-20" }),
  ];
  const md = buildSummary(entries, { now: "2026-05-23", staleDays: 21 });
  assert.doesNotMatch(md, /PROJ-DONE/);
  assert.match(md, /PROJ-LIVE/);
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/reports/summary.js`**

```javascript
// lib/reports/summary.js

const CATEGORY_ORDER = ["work", "personal"];
const TYPE_ORDER = ["ticketed", "unticketed", "learning", "idea"];
const TYPE_HEADING = {
  ticketed: "Ticketed",
  unticketed: "Unticketed",
  learning: "Learning",
  idea: "Ideas",
};

/**
 * @typedef {import("../entries/list.js").EntrySummary} EntrySummary
 * @typedef {{ now: string, staleDays: number }} SummaryOpts
 */

/**
 * @param {EntrySummary[]} entries
 * @param {SummaryOpts} opts
 * @returns {string} markdown body
 */
export function buildSummary(entries, opts) {
  const live = entries.filter((e) => e.data.status !== "done");
  const lines = [`# Summary (${opts.now})\n`];
  for (const category of CATEGORY_ORDER) {
    const ofCategory = live.filter((e) => e.data.category === category);
    if (ofCategory.length === 0) continue;
    lines.push(`## ${capitalize(category)}\n`);
    for (const type of TYPE_ORDER) {
      const ofType = ofCategory.filter((e) => e.data.type === type);
      if (ofType.length === 0) continue;
      lines.push(`### ${TYPE_HEADING[type]} (${ofType.length})`);
      ofType.sort((a, b) => (b.data.updated ?? "").localeCompare(a.data.updated ?? ""));
      for (const e of ofType) {
        const age = ageInDays(e.data.updated, opts.now);
        const stale = age !== null && age > opts.staleDays ? " ⚠️ stale" : "";
        const ageStr = age === null ? "unknown" : age === 0 ? "today" : `${age}d ago`;
        lines.push(`- **${e.pointer.id}** — ${ageStr}${stale}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

function ageInDays(updated, now) {
  if (!updated) return null;
  const a = Date.parse(updated);
  const b = Date.parse(now);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reports/summary.js test/reports/summary.test.js
git commit -m "Add summary report builder with stale marker"
```

---

### Task 22: `lib/reports/completion.js` — done in time range

**Files:**
- Create: `lib/reports/completion.js`
- Create: `test/reports/completion.test.js`

Lists everything that became `done` within the range. Items with both `status: done` and `promoted_to` set are surfaced under "Promoted from idea" (per spec §5.3).

- [ ] **Step 1: Write the test**

```javascript
// test/reports/completion.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCompletion } from "../../lib/reports/completion.js";

const entry = (over) => ({
  pointer: { category: over.category ?? "work", type: over.type ?? "ticketed", id: over.id },
  layout: "dir",
  path: "/dev/null",
  data: {
    category: over.category ?? "work",
    type: over.type ?? "ticketed",
    status: "done",
    updated: over.updated,
    prs: over.prs,
    promoted_to: over.promoted_to,
    ticket_id: over.id,
    ...over.data,
  },
});

test("buildCompletion lists done entries within range, grouped by category × type", () => {
  const entries = [
    entry({ id: "PROJ-100", updated: "2026-04-29", prs: [{ id: 1 }, { id: 2 }, { id: 3 }] }),
    entry({ id: "PROJ-105", updated: "2026-05-12", prs: [{ id: 4 }] }),
    entry({ id: "outside", updated: "2026-01-01" }),
  ];
  const md = buildCompletion(entries, { from: "2026-04-23", to: "2026-05-23" });
  assert.match(md, /Completed.*2026-04-23\.\.2026-05-23/);
  assert.match(md, /## Work/);
  assert.match(md, /### Ticketed \(2\)/);
  assert.match(md, /PROJ-100.*done 2026-04-29.*3 PRs/);
  assert.doesNotMatch(md, /outside/);
});

test("buildCompletion surfaces promotions under 'Promoted from idea'", () => {
  const entries = [
    entry({
      category: "personal",
      type: "idea",
      id: "spark",
      updated: "2026-05-08",
      promoted_to: "personal/unticketed/spark-poc",
    }),
  ];
  const md = buildCompletion(entries, { from: "2026-05-01", to: "2026-05-23" });
  assert.match(md, /## Personal/);
  assert.match(md, /### Promoted from idea \(1\)/);
  assert.match(md, /spark.*→.*personal\/unticketed\/spark-poc.*2026-05-08/);
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/reports/completion.js`**

```javascript
// lib/reports/completion.js

const CATEGORY_ORDER = ["work", "personal"];
const TYPE_ORDER = ["ticketed", "unticketed", "learning"];

/**
 * @typedef {import("../entries/list.js").EntrySummary} EntrySummary
 * @typedef {{ from: string, to: string }} DateRange
 */

/**
 * @param {EntrySummary[]} entries
 * @param {DateRange} range
 * @returns {string} markdown body
 */
export function buildCompletion(entries, range) {
  const inRange = entries.filter(
    (e) =>
      e.data.status === "done" &&
      (e.data.updated ?? "") >= range.from &&
      (e.data.updated ?? "") <= range.to,
  );
  const lines = [`# Completed (${range.from}..${range.to})\n`];
  for (const category of CATEGORY_ORDER) {
    const ofCategory = inRange.filter((e) => e.data.category === category);
    if (ofCategory.length === 0) continue;
    lines.push(`## ${capitalize(category)}\n`);

    // Standard types (excluding promoted-from-idea which gets its own bucket)
    for (const type of TYPE_ORDER) {
      const ofType = ofCategory.filter(
        (e) => e.data.type === type && !e.data.promoted_to,
      );
      if (ofType.length === 0) continue;
      lines.push(`### ${headingFor(type)} (${ofType.length})`);
      for (const e of ofType) {
        const prCount = Array.isArray(e.data.prs) ? e.data.prs.length : 0;
        const prSuffix = prCount > 0 ? ` — ${prCount} PR${prCount > 1 ? "s" : ""}` : "";
        lines.push(`- **${e.pointer.id}** — done ${e.data.updated}${prSuffix}`);
      }
      lines.push("");
    }

    // Promoted ideas
    const promoted = ofCategory.filter(
      (e) => e.data.type === "idea" && e.data.promoted_to,
    );
    if (promoted.length > 0) {
      lines.push(`### Promoted from idea (${promoted.length})`);
      for (const e of promoted) {
        lines.push(`- \`${e.pointer.id}\` → \`${e.data.promoted_to}\` on ${e.data.updated}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

function headingFor(type) {
  if (type === "ticketed") return "Ticketed";
  if (type === "unticketed") return "Unticketed";
  if (type === "learning") return "Learning";
  return type;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reports/completion.js test/reports/completion.test.js
git commit -m "Add completion report builder"
```

---

### Task 23: `lib/reports/prediction.js` — data collection for LLM prediction

**Files:**
- Create: `lib/reports/prediction.js`
- Create: `test/reports/prediction.test.js`

The prediction report's narrative comes from the LLM in the report skill. The Node helper just collects the data: all `idea` entries, plus all entries with `status: in-progress` or recently `done` (e.g., last 60 days), so the LLM has the right context.

Note: per spec §5.4, prediction does NOT apply category isolation — both categories are loaded together.

- [ ] **Step 1: Write the test**

```javascript
// test/reports/prediction.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { updateEntryFrontmatter } from "../../lib/entries/update.js";
import { collectPredictionData } from "../../lib/reports/prediction.js";

const D = (n) => `2026-05-${String(n).padStart(2, "0")}`;

test("collectPredictionData returns ideas and recent active/done entries from both categories", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "work", type: "idea", id: "auto-tag" },
      layout: "file",
      extras: { seed_date: D(1) },
      body: "Auto-tag idea body.\n",
      now: D(1),
    });
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "spark" },
      layout: "file",
      extras: { seed_date: D(2) },
      body: "Spark.\n",
      now: D(2),
    });
    createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "PROJ-1" },
      layout: "dir",
      extras: { ticket_id: "PROJ-1", project: "project-a" },
      body: "Active ticket.\n",
      now: D(5),
    });
    updateEntryFrontmatter(
      root,
      { category: "work", type: "ticketed", id: "PROJ-1" },
      { status: "in-progress", updated: D(20) },
    );
    createEntry(root, {
      pointer: { category: "personal", type: "learning", id: "rust-async" },
      layout: "dir",
      extras: { topic: "rust async" },
      body: "Learning rust async.\n",
      now: D(3),
    });
    updateEntryFrontmatter(
      root,
      { category: "personal", type: "learning", id: "rust-async" },
      { status: "done", updated: D(22) },
    );

    const data = collectPredictionData(root, { now: D(23), lookbackDays: 60 });
    const ideaIds = data.ideas.map((i) => i.pointer.id).sort();
    assert.deepEqual(ideaIds, ["auto-tag", "spark"]);
    const activeIds = data.activeAndRecentDone.map((e) => e.pointer.id).sort();
    assert.deepEqual(activeIds, ["PROJ-1", "rust-async"]);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/reports/prediction.js`**

```javascript
// lib/reports/prediction.js
import { listEntries } from "../entries/list.js";

/**
 * Collect data for the LLM-driven prediction report. No category isolation.
 *
 * @param {string} root
 * @param {{ now: string, lookbackDays: number }} opts
 * @returns {{ ideas: ReturnType<typeof listEntries>, activeAndRecentDone: ReturnType<typeof listEntries> }}
 */
export function collectPredictionData(root, opts) {
  const lookbackDate = subtractDays(opts.now, opts.lookbackDays);
  const ideas = listEntries(root, { type: "idea" });
  const all = listEntries(root, {});
  const activeAndRecentDone = all.filter((e) => {
    if (e.data.type === "idea") return false;
    if (e.data.status === "in-progress") return true;
    if (e.data.status === "done" && (e.data.updated ?? "") >= lookbackDate) return true;
    return false;
  });
  return { ideas, activeAndRecentDone };
}

function subtractDays(date, days) {
  const t = Date.parse(date);
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(t - ms).toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reports/prediction.js test/reports/prediction.test.js
git commit -m "Add prediction data collector (no category isolation)"
```

---

### Task 24: `lib/reports/perf-review.js` — hard category isolation

**Files:**
- Create: `lib/reports/perf-review.js`
- Create: `test/reports/perf-review.test.js`

This module is the **structural safety boundary** for perf review. It:
1. Globs ONLY `<root>/<category>/**` — the other category's files never load.
2. Validates each loaded entry's frontmatter `category` matches the requested filter (catches misplaced files).
3. Returns entries + anchors for the LLM to synthesize.

- [ ] **Step 1: Write the test**

```javascript
// test/reports/perf-review.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { updateEntryFrontmatter } from "../../lib/entries/update.js";
import { collectPerfReviewData } from "../../lib/reports/perf-review.js";

const D = (n) => `2026-04-${String(n).padStart(2, "0")}`;

test("collectPerfReviewData with category=work returns only work entries", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "PROJ-1" },
      layout: "dir",
      extras: { ticket_id: "PROJ-1", project: "project-a", prs: [{ id: 1 }, { id: 2 }] },
      body: "work entry body",
      now: D(1),
    });
    updateEntryFrontmatter(
      root,
      { category: "work", type: "ticketed", id: "PROJ-1" },
      { status: "done", updated: D(8) },
    );
    createEntry(root, {
      pointer: { category: "personal", type: "ticketed", id: "MYAPP-1" },
      layout: "dir",
      extras: { ticket_id: "MYAPP-1", project: "my-app" },
      body: "personal entry body",
      now: D(1),
    });
    updateEntryFrontmatter(
      root,
      { category: "personal", type: "ticketed", id: "MYAPP-1" },
      { status: "done", updated: D(10) },
    );

    const data = collectPerfReviewData(root, {
      category: "work",
      from: D(1),
      to: D(30),
    });
    assert.equal(data.entries.length, 1);
    assert.equal(data.entries[0].pointer.id, "PROJ-1");
    assert.equal(data.anchors.ticketsClosed, 1);
    assert.equal(data.anchors.prsMerged, 2);
  });
});

test("collectPerfReviewData rejects entries whose frontmatter disagrees with directory", async () => {
  await withTmpDir(async (root) => {
    // Manually craft a misplaced file: under work/ but with category: personal in frontmatter.
    const { writeFrontmatter } = await import("../../lib/frontmatter.js");
    const { join } = await import("node:path");
    writeFrontmatter(
      join(root, "work", "ticketed", "STRAY.md"),
      {
        category: "personal",
        type: "ticketed",
        status: "done",
        created: D(1),
        updated: D(5),
        layout: "file",
      },
      "stray body",
    );
    const data = collectPerfReviewData(root, {
      category: "work",
      from: D(1),
      to: D(30),
    });
    assert.equal(data.entries.length, 0);
    assert.equal(data.warnings.length, 1);
    assert.match(data.warnings[0], /STRAY.*frontmatter category mismatch/);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/reports/perf-review.js`**

```javascript
// lib/reports/perf-review.js
import { listEntries } from "../entries/list.js";
import { computeAnchors } from "./stats.js";

/**
 * Collect data for a perf review with hard category isolation.
 *
 * Phase 1: glob only the requested category directory (the other category's
 * files are never visited).
 * Phase 2: validate each entry's frontmatter `category` matches the request;
 * mismatched entries are dropped with a warning instead of being included.
 *
 * @param {string} root
 * @param {{ category: "work" | "personal", from: string, to: string }} opts
 * @returns {{
 *   category: "work" | "personal",
 *   from: string,
 *   to: string,
 *   entries: ReturnType<typeof listEntries>,
 *   anchors: ReturnType<typeof computeAnchors>,
 *   warnings: string[],
 * }}
 */
export function collectPerfReviewData(root, opts) {
  // Phase 1: list only requested category (listEntries respects category filter
  // and only visits that subtree).
  const candidates = listEntries(root, { category: opts.category });

  // Phase 2: belt-and-suspenders frontmatter validation.
  const warnings = [];
  const entries = [];
  for (const e of candidates) {
    if (e.data.category !== opts.category) {
      warnings.push(
        `Skipping ${e.pointer.category}/${e.pointer.type}/${e.pointer.id}: frontmatter category mismatch (expected ${opts.category}, got ${e.data.category}).`,
      );
      continue;
    }
    const updated = e.data.updated ?? "";
    if (updated < opts.from || updated > opts.to) continue;
    entries.push(e);
  }

  // Anchor numbers are computed from the FILTERED list (only matching category, in range).
  const anchors = computeAnchors(entries, { from: opts.from, to: opts.to });

  return {
    category: opts.category,
    from: opts.from,
    to: opts.to,
    entries,
    anchors,
    warnings,
  };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reports/perf-review.js test/reports/perf-review.test.js
git commit -m "Add perf review data collector with hard category isolation"
```

---

### Task 25: `lib/reports/write.js` — write a report file with timestamped name

**Files:**
- Create: `lib/reports/write.js`
- Create: `test/reports/write.test.js`

`writeReport(root, kind, body, meta)` writes the markdown to `archievement/reports/<filename>` (perf-review uses a subdir) with a timestamp suffix so same-day calls never overwrite.

Filename format:
- `summary` / `completion` / `prediction` → `reports/<YYYY-MM-DDTHH-MM>-<kind>.md`
- `perf-review` → `reports/perf-review/<YYYY-MM-DDTHH-MM>-<category>.md`

- [ ] **Step 1: Write the test**

```javascript
// test/reports/write.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import { writeReport, makeReportFilename } from "../../lib/reports/write.js";

test("makeReportFilename uses timestamp suffix for ordinary kinds", () => {
  const name = makeReportFilename({ kind: "summary", timestamp: "2026-05-23T14-32" });
  assert.equal(name, "2026-05-23T14-32-summary.md");
});

test("makeReportFilename routes perf-review to subdirectory with category suffix", () => {
  const name = makeReportFilename({
    kind: "perf-review",
    timestamp: "2026-05-23T14-32",
    category: "work",
  });
  assert.equal(name, "perf-review/2026-05-23T14-32-work.md");
});

test("writeReport creates the file with given frontmatter and body", async () => {
  await withTmpDir(async (root) => {
    const path = writeReport(root, {
      kind: "summary",
      timestamp: "2026-05-23T14-32",
      frontmatter: {
        type: "report",
        kind: "summary",
        generated: "2026-05-23",
        range: "snapshot",
        language: "zh",
        category_filter: null,
      },
      body: "# Summary\n\nBody.\n",
    });
    assert.ok(path.endsWith("2026-05-23T14-32-summary.md"));
    assert.ok(existsSync(path));
    const content = readFileSync(path, "utf8");
    assert.match(content, /kind: summary/);
    assert.match(content, /# Summary/);
  });
});

test("writeReport with perf-review writes into perf-review subdir", async () => {
  await withTmpDir(async (root) => {
    const path = writeReport(root, {
      kind: "perf-review",
      timestamp: "2026-05-23T14-32",
      category: "work",
      frontmatter: {
        type: "report",
        kind: "perf-review",
        generated: "2026-05-23",
        range: "2025-11-01..2026-04-30",
        language: "en",
        category_filter: "work",
      },
      body: "# Perf review draft.\n",
    });
    assert.ok(path.endsWith("/reports/perf-review/2026-05-23T14-32-work.md"));
    assert.ok(existsSync(path));
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/reports/write.js`**

```javascript
// lib/reports/write.js
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeFrontmatter } from "../frontmatter.js";

/**
 * @typedef {"summary" | "completion" | "prediction" | "perf-review"} ReportKind
 *
 * @typedef {{
 *   kind: ReportKind,
 *   timestamp: string,
 *   category?: "work" | "personal",
 * }} ReportFilenameOpts
 *
 * @typedef {{
 *   kind: ReportKind,
 *   timestamp: string,
 *   category?: "work" | "personal",
 *   frontmatter: Record<string, unknown>,
 *   body: string,
 * }} WriteReportOpts
 */

/**
 * @param {ReportFilenameOpts} opts
 * @returns {string} relative filename under archievement/reports/
 */
export function makeReportFilename(opts) {
  if (opts.kind === "perf-review") {
    if (!opts.category) {
      throw new Error("perf-review report requires opts.category");
    }
    return `perf-review/${opts.timestamp}-${opts.category}.md`;
  }
  return `${opts.timestamp}-${opts.kind}.md`;
}

/**
 * @param {string} root archievement_root absolute path
 * @param {WriteReportOpts} opts
 * @returns {string} absolute path to the written file
 */
export function writeReport(root, opts) {
  const relName = makeReportFilename(opts);
  const absPath = join(root, "reports", relName);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFrontmatter(absPath, opts.frontmatter, opts.body);
  return absPath;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reports/write.js test/reports/write.test.js
git commit -m "Add report file writer with timestamped names"
```

---

## Section 6 — Skills (markdown)

Skills are markdown files Claude reads when invoked. They are instructions, not executable code, so the "test" for a skill is a frontmatter sanity check + a careful read-through. We add one shared test in Task 26 that validates every `skills/*/SKILL.md` has a well-formed frontmatter.

### Task 26: `skills/setup/SKILL.md` + shared skill frontmatter sanity test

**Files:**
- Create: `skills/setup/SKILL.md`
- Create: `test/skills.test.js`

- [ ] **Step 1: Write the shared sanity test**

```javascript
// test/skills.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(HERE, "..", "skills");

test("each skills/*/SKILL.md has well-formed frontmatter and a body", () => {
  const entries = readdirSync(SKILLS_DIR).filter(
    (n) => statSync(join(SKILLS_DIR, n)).isDirectory(),
  );
  assert.ok(entries.length > 0, "no skills present");
  for (const skill of entries) {
    const skillFile = join(SKILLS_DIR, skill, "SKILL.md");
    let raw;
    try {
      raw = readFileSync(skillFile, "utf8");
    } catch (err) {
      assert.fail(`${skill}: SKILL.md not readable (${err.message})`);
    }
    const { data, content } = matter(raw);
    assert.ok(data.name, `${skill}: frontmatter missing 'name'`);
    assert.match(data.name, /^[a-z][a-z0-9-]*$/, `${skill}: name must be kebab-case`);
    assert.ok(data.description, `${skill}: frontmatter missing 'description'`);
    assert.ok(data.description.length >= 20, `${skill}: description too short`);
    assert.ok(content.trim().length > 100, `${skill}: body too short`);
  }
});
```

- [ ] **Step 2: Write `skills/setup/SKILL.md`**

```markdown
---
name: setup
description: Initialize archievement on first install — asks where to put the archievement folder and the default language, creates directory skeleton, writes config files.
---

# archievement:setup

Run this once after installing the plugin. Subsequent runs detect an existing setup and refuse to overwrite without confirmation.

## Goal

Create the archievement folder and its config files, then write a discovery pointer at `~/.archievementrc` so other archievement skills can find the root from any working directory.

## Flow

1. **Detect existing setup.** Read `~/.archievementrc`. If it exists and points to a directory containing `config/global.yml`, ask the user via AskUserQuestion: "archievement is already set up at `<path>`. Re-initialize?" with options `Keep existing` / `Re-run setup`. Stop if they choose Keep.

2. **Ask where the archievement folder goes.** AskUserQuestion: "Where should the archievement folder live?" options `~/archievement (default)` / `specify a different path`. If they pick "specify", prompt the user to type the path. Expand `~`.

3. **Ask default language.** First inspect the user's message language in this session and any languages already in `config/user-prefs.yml` (if it exists at the resolved root). Construct AskUserQuestion options dynamically: the detected language plus English. If only English is detected, ask `Confirm: English` / `Specify another`.

4. **Create directory skeleton** via Bash:

   ```
   mkdir -p "$ROOT"/{work/{ticketed,unticketed,learning,ideas},personal/{ticketed,unticketed,learning,ideas},reports/perf-review,config}
   ```

5. **Write `config/global.yml`** using the helpers in `lib/config/global.js`. The script invocation looks like:

   ```
   node -e "
     import('${CLAUDE_PLUGIN_ROOT}/lib/config/global.js').then(({ writeGlobalConfig }) =>
       writeGlobalConfig('$ROOT/config/global.yml', {
         default_language: '$LANG',
         stale_days: 21,
         archievement_root: '$ROOT',
       })
     );
   "
   ```

6. **Write `config/projects.yml`** with empty arrays via `lib/config/projects.js`.

7. **Write `config/user-prefs.yml`** with `languages_known: [<chosen>, "en"]` (deduped).

8. **Write `~/.archievementrc`.** Just the absolute path on a single line.

9. **Confirm completion.** Tell the user where files were written and what the next step is (probably `/archievement:record`).

## Edge cases

- The chosen path's parent directory doesn't exist → create it.
- The chosen path already exists and is non-empty → AskUserQuestion to confirm before writing anything.
- The user is currently inside an existing archievement root → warn but proceed.
- Path expansion of `~` must use the current user's home dir from `$HOME`.
```

- [ ] **Step 3: Run, expect pass**

Run: `npm test`
Expected: PASS — including the new `skills.test.js`.

- [ ] **Step 4: Commit**

```bash
git rm skills/setup/.gitkeep
git add skills/setup/SKILL.md test/skills.test.js
git commit -m "Add setup skill and skill-frontmatter sanity test"
```

---

### Task 27: `skills/record/SKILL.md`

**Files:**
- Create: `skills/record/SKILL.md`

This is the largest skill. It captures session content into an entry, creating one if needed. Every write is preceded by AskUserQuestion confirmations.

- [ ] **Step 1: Write the file**

```markdown
---
name: record
description: Distill the current Claude Code session into an archievement entry — creates or updates an entry, asks scope and content type via AskUserQuestion before writing.
---

# archievement:record

## When to use

Invoke when the user wants to save part of the current session: brainstorm, plan, PR summary, progress note, raw idea, or learning log.

## Read first

Before any prompting, read the runtime state:

1. **archievement root**: from `~/.archievementrc` (or run `/archievement:setup` if missing — AskUserQuestion to confirm).
2. **Project context**: if a `<archievement-context>` block was injected by the SessionStart hook, parse it. It tells you the project slug, category, language, and the list of active entries (`todo` + `in-progress`).
3. **Current Node module paths**: helpers live under `${CLAUDE_PLUGIN_ROOT}/lib/`. Use them via `node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/<path>').then(...)"` or by writing a small driver to a tmp file and executing it. Never re-implement entry CRUD inline.

## Flow

1. **Determine intent — new vs. update.** AskUserQuestion: "What are you recording?" with options:
   - `Update an existing entry` (only show this option if active entries exist in context)
   - `Create a new entry`

2. **If updating an existing entry:**
   a. AskUserQuestion: "Which entry?" with options drawn from the active entries list, plus a `Search all entries` escape hatch.
   b. AskUserQuestion: "What doc?" options `progress / brainstorm / plan / tasks / pr-summary / new section in main body`. (`pr-summary` only valid for dir-layout entries.)
   c. AskUserQuestion: "What scope of the session content?" options `entire session / last N turns (pick N) / I'll specify a range / I'll tell you the content directly`.
   d. Pull content from session accordingly. For PR summaries, also pull the PR ID, title, URL from context (look for the `<archievement-nudge>` block that the `gh pr create` hook injected, or ask the user).
   e. Draft the markdown section. Use the language resolved from project's language (frontmatter `language` in projects.yml entry) → falling back to global default.
   f. Show the user the draft. AskUserQuestion: `Save / Let me edit / Cancel`.
   g. On save: call `appendToDoc` or `writeSiblingDoc` (for pr-summaries) from `lib/entries/update.js`. Also call `updateEntryFrontmatter` to bump `updated`.
   h. AskUserQuestion: "Update status?" options `Leave as is / todo / in-progress / done`. If changed, call `updateEntryFrontmatter`.

3. **If creating a new entry:**
   a. AskUserQuestion category. If cwd context says work or personal, offer that as default; otherwise: `work / personal`.
   b. AskUserQuestion type: `ticketed / unticketed / learning / idea`.
   c. For `ticketed`: ask the ticket ID (free-form). For others: ask a slug (kebab-case).
   d. AskUserQuestion layout (skip for `idea` — always file): `dir (complex, expandable) / file (lightweight, expandable later)`.
   e. AskUserQuestion: "What's the initial doc?" options `brainstorm / plan / I'll just create the entry with no body yet`.
   f. Scope question (same as above).
   g. Draft body.
   h. Confirm + save: call `createEntry` from `lib/entries/create.js`.

4. **Final report.** Tell the user the on-disk path of the file you wrote and the new entry's status.

## Invariants

- **Never write to disk without an explicit Save confirmation from the user.**
- **Never invent ticket IDs, slugs, project names, or content.** Always pull from session context or AskUserQuestion.
- **Status changes are always explicit.** The skill never sets status to `in-progress` or `done` based on inference; it only changes status when the user picks an option.
- **Frontmatter is always English.** Body prose follows the resolved language.

## Cross-skill calls

- If the user describes promotion intent ("turn this idea into a ticket"), call `/archievement:promote` via the Skill tool instead of trying to handle it inline.
- If the user asks for a report, call `/archievement:report` instead.
```

- [ ] **Step 2: Run, expect pass**

Run: `npm test`
Expected: PASS — including the skills sanity test, which will now check the `record` SKILL.md too.

- [ ] **Step 3: Commit**

```bash
git rm skills/record/.gitkeep
git add skills/record/SKILL.md
git commit -m "Add record skill"
```

---

### Task 28: `skills/promote/SKILL.md`

**Files:**
- Create: `skills/promote/SKILL.md`

- [ ] **Step 1: Write the file**

```markdown
---
name: promote
description: Promote an archievement entry — idea → ticketed/unticketed, or unticketed → ticketed, possibly across categories. Handles file → dir expansion and writes reciprocal audit-trail links.
---

# archievement:promote

## When to use

Invoke when an existing entry needs to graduate to a new form:
- `idea` → `ticketed` or `unticketed` (and possibly cross-category)
- `unticketed` → `ticketed` (e.g., the company opened a JIRA for what was research)
- file-layout → dir-layout expansion (without category/type change)

## Flow

1. **Identify the source entry.** AskUserQuestion: "Which entry are you promoting?" Show active entries from the session context block; offer `Search by id/slug` as an escape hatch.

2. **Ask the target.** AskUserQuestion sequentially:
   - Target type: `ticketed / unticketed / learning / idea` (default to a sensible next step based on source type).
   - Target category: `work / personal` (default to source category).
   - Target id or slug. For `ticketed`, ask for the ticket ID. For others, propose a kebab-case slug derived from the source title; let the user edit.
   - Target layout: `dir / file` — required if source is file-layout and the user wants dir.

3. **Show a plan.** Print: "Promoting `<source>` → `<target>`. The source will be marked `done`, with `promoted_to: <target>`. The target gets `promoted_from: <source>`." AskUserQuestion `Proceed / Cancel`.

4. **Execute.** Call `promote()` from `lib/promote/orchestrate.js`. Pass `now = today (YYYY-MM-DD)`, `targetLayout`, and any type-specific `extras` (e.g., `ticket_id`, `project`).

5. **Report.** Tell the user the new entry's path and remind them the source is preserved (audit trail), not deleted.

## Invariants

- Never overwrite an existing target — orchestrate.js refuses; surface the error and ask the user for a different id.
- Never delete the source. If the user wants it gone, instruct them to `rm` it manually.
- `extras` must include `ticket_id` when target type is `ticketed`; otherwise the data will be inconsistent. Ask if missing.
```

- [ ] **Step 2: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git rm skills/promote/.gitkeep
git add skills/promote/SKILL.md
git commit -m "Add promote skill"
```

---

### Task 29: `skills/report/SKILL.md`

**Files:**
- Create: `skills/report/SKILL.md`

- [ ] **Step 1: Write the file**

```markdown
---
name: report
description: Generate an archievement report — summary (in-progress snapshot), completion (done in time range), prediction (idea-advancement suggestions), or perf-review (with hard category isolation).
---

# archievement:report

## When to use

Invoke when the user wants to see progress, write a monthly self-tracking report, or generate a perf review draft.

## Flow

1. **Read setup.** Resolve archievement root from `~/.archievementrc`. Read `config/global.yml` for `default_language` and `stale_days`. Read `config/user-prefs.yml` for `languages_known`.

2. **Ask kind.** AskUserQuestion: "Which report?" options `summary (snapshot) / completion (done in range) / prediction (idea advancement) / perf-review`.

3. **For `summary`:**
   a. AskUserQuestion category filter (optional): `both / work only / personal only`. Default `both`.
   b. Call `listEntries(root, { category? })` from `lib/entries/list.js`.
   c. Call `buildSummary(entries, { now: today, staleDays: global.stale_days })` from `lib/reports/summary.js`.
   d. Determine output language (per session/global preference).
   e. Write the report via `writeReport(root, { kind: "summary", timestamp, frontmatter, body })`.

4. **For `completion`:**
   a. AskUserQuestion range: `last 7 days / last 30 days / last 90 days / specify range`.
   b. AskUserQuestion category filter (optional, default both).
   c. `listEntries` + `buildCompletion(entries, { from, to })`.
   d. Write report.

5. **For `prediction`:**
   a. AskUserQuestion lookback: `last 60 days (default) / specify`.
   b. `collectPredictionData(root, { now, lookbackDays })` from `lib/reports/prediction.js`.
   c. **Synthesize the narrative yourself** using the LLM (this is not Node code). Layout: list each idea, propose connections to recent active/done entries by reading their summaries, suggest a promotion target (type/category/slug). Skip ideas with no clear connection (put them under "No clear path yet").
   d. Write report.

6. **For `perf-review`:**
   a. AskUserQuestion category: `work / personal`. **No `both` option** (single-audience).
   b. AskUserQuestion range: `last month / last half (180 days) / last year / specify`.
   c. AskUserQuestion: "Did you paste a perf review template / company criteria into this session?" `Yes — use it / No — generate free-form draft`.
   d. `collectPerfReviewData(root, { category, from, to })` from `lib/reports/perf-review.js`. **The other category is physically unread** — never load it.
   e. If `data.warnings.length > 0`, surface them to the user before proceeding.
   f. **Synthesize the narrative yourself** using the LLM. Use the template the user pasted if provided; otherwise use the free-form structure from spec §5.5. Pull the deterministic `anchors` from `data.anchors` — never re-compute or estimate; copy them verbatim.
   g. Always append the disclaimer from spec §5.5 verbatim.
   h. Write report under `reports/perf-review/<timestamp>-<category>.md`.

7. **Tell the user the report's path.**

## Invariants

- **`perf-review` never has access to the other category's data.** The data-collection function physically skips the other directory; do not try to widen the scope.
- **Anchors are sacred.** Numbers in perf-review reports come from `data.anchors`, not from estimation. If the user asks "what about my PR count for X", point them at the report's Anchors section, not your own count.
- **`prediction` is allowed to cross categories** (per spec §5.4) but the report's output is never auto-fed into a perf-review.
```

- [ ] **Step 2: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git rm skills/report/.gitkeep
git add skills/report/SKILL.md
git commit -m "Add report skill"
```

---

## Section 7 — Hooks

### Task 30: `hooks/hooks.json` + `hooks/run-hook.cmd`

**Files:**
- Create: `hooks/hooks.json`
- Create: `hooks/run-hook.cmd`

`run-hook.cmd` is the cross-platform polyglot from superpowers. We reproduce it verbatim and attribute it to the original author in the README (MIT).

- [ ] **Step 1: Reference the source**

Read `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/hooks/run-hook.cmd` for the canonical content. Copy it byte-for-byte into our `hooks/run-hook.cmd`.

- [ ] **Step 2: Write `hooks/hooks.json`**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" session-start",
            "async": false
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" post-tool-use-gh-pr-create",
            "async": false
          }
        ]
      }
    ]
  }
}
```

(The PostToolUse hook fires after every Bash command; the script filters by parsing input and silently exits unless the command was `gh pr create`. This is the same pattern superpowers uses for its hooks.)

- [ ] **Step 3: Commit**

```bash
git rm hooks/.gitkeep
git add hooks/hooks.json hooks/run-hook.cmd
git commit -m "Add hook configuration and cross-platform runner"
```

---

### Task 31: SessionStart hook — bash wrapper + Node logic

**Files:**
- Create: `hooks/session-start` (bash, no extension)
- Create: `lib/hooks/session-start.js`
- Create: `test/hooks/session-start.test.js`

The bash wrapper just execs the Node helper. The Node helper does the work: reads stdin (Claude Code passes a JSON object on stdin), figures out the archievement root, queries projects.yml + entries, and emits JSON on stdout (`{ hookSpecificOutput: { additionalContext: "..." } }`).

- [ ] **Step 1: Write the Node-logic test**

```javascript
// test/hooks/session-start.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { withTmpDir } from "../helpers/tmp.js";
import { runSessionStart } from "../../lib/hooks/session-start.js";
import { writeProjectsConfig } from "../../lib/config/projects.js";
import { createEntry } from "../../lib/entries/create.js";

const TODAY = "2026-05-23";

test("runSessionStart returns empty additionalContext when archievementrc missing", async () => {
  await withTmpDir(async (tmpHome) => {
    const result = await runSessionStart({
      cwd: tmpHome,
      now: TODAY,
      archievementrcPath: join(tmpHome, ".archievementrc"),
      getProjectProbe: () => ({ remote: null, cwd: tmpHome }),
    });
    assert.equal(result.additionalContext, "");
  });
});

test("runSessionStart injects 'unregistered' when project not in projects.yml", async () => {
  await withTmpDir(async (tmpHome) => {
    await withTmpDir(async (root) => {
      writeFileSync(join(tmpHome, ".archievementrc"), root);
      mkdirSync(join(root, "config"), { recursive: true });
      writeProjectsConfig(join(root, "config", "projects.yml"), { projects: [], ignore: [] });
      const result = await runSessionStart({
        cwd: "/some/random/path",
        now: TODAY,
        archievementrcPath: join(tmpHome, ".archievementrc"),
        getProjectProbe: () => ({ remote: "github.com/me/new", cwd: "/some/random/path" }),
      });
      assert.match(result.additionalContext, /<archievement-context>/);
      assert.match(result.additionalContext, /unregistered project/);
    });
  });
});

test("runSessionStart injects active entries when project is registered", async () => {
  await withTmpDir(async (tmpHome) => {
    await withTmpDir(async (root) => {
      writeFileSync(join(tmpHome, ".archievementrc"), root);
      mkdirSync(join(root, "config"), { recursive: true });
      writeProjectsConfig(join(root, "config", "projects.yml"), {
        projects: [
          {
            match: { type: "git-remote", url: "github.com/me/project-a" },
            slug: "project-a",
            category: "work",
          },
        ],
        ignore: [],
      });
      createEntry(root, {
        pointer: { category: "work", type: "ticketed", id: "PROJ-1" },
        layout: "dir",
        extras: { ticket_id: "PROJ-1", project: "project-a" },
        body: "",
        now: TODAY,
      });
      const result = await runSessionStart({
        cwd: "/wherever",
        now: TODAY,
        archievementrcPath: join(tmpHome, ".archievementrc"),
        getProjectProbe: () => ({ remote: "github.com/me/project-a", cwd: "/wherever" }),
      });
      assert.match(result.additionalContext, /project: project-a/);
      assert.match(result.additionalContext, /category: work/);
      assert.match(result.additionalContext, /PROJ-1 \(todo\)/);
    });
  });
});

test("runSessionStart stays silent for explicitly-ignored cwd", async () => {
  await withTmpDir(async (tmpHome) => {
    await withTmpDir(async (root) => {
      writeFileSync(join(tmpHome, ".archievementrc"), root);
      mkdirSync(join(root, "config"), { recursive: true });
      writeProjectsConfig(join(root, "config", "projects.yml"), {
        projects: [],
        ignore: [{ match: { type: "path", path: "/tmp/ignored" } }],
      });
      const result = await runSessionStart({
        cwd: "/tmp/ignored",
        now: TODAY,
        archievementrcPath: join(tmpHome, ".archievementrc"),
        getProjectProbe: () => ({ remote: null, cwd: "/tmp/ignored" }),
      });
      assert.equal(result.additionalContext, "");
    });
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — `lib/hooks/session-start.js` missing.

- [ ] **Step 3: Implement `lib/hooks/session-start.js`**

```javascript
// lib/hooks/session-start.js
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { readProjectsConfig, matchProject } from "../config/projects.js";
import { listEntries } from "../entries/list.js";
import { getProjectProbe as realProbe } from "../git.js";

/**
 * @typedef {{
 *   cwd: string,
 *   now: string,
 *   archievementrcPath?: string,
 *   getProjectProbe?: (cwd: string) => { remote: string | null, cwd: string },
 * }} RunSessionStartInput
 *
 * @typedef {{ additionalContext: string }} RunSessionStartOutput
 */

/**
 * Pure, injectable session-start logic. The CLI wrapper supplies real I/O.
 *
 * @param {RunSessionStartInput} input
 * @returns {Promise<RunSessionStartOutput>}
 */
export async function runSessionStart(input) {
  const archievementrcPath = input.archievementrcPath ?? join(homedir(), ".archievementrc");
  if (!existsSync(archievementrcPath)) {
    return { additionalContext: "" };
  }
  const root = readFileSync(archievementrcPath, "utf8").trim();
  if (!root) return { additionalContext: "" };

  const probe = (input.getProjectProbe ?? realProbe)(input.cwd);
  const projectsPath = join(root, "config", "projects.yml");
  const projectsConfig = readProjectsConfig(projectsPath);
  const result = matchProject(projectsConfig, probe);

  if (result.kind === "ignored") {
    return { additionalContext: "" };
  }

  if (result.kind === "unknown") {
    return {
      additionalContext: wrap(
        [
          "unregistered project — cwd is not in archievement's projects.yml.",
          "If any archievement skill is invoked, prompt the user to register or ignore this project.",
        ].join("\n"),
      ),
    };
  }

  const project = result.project;
  const active = listEntries(root, { category: project.category, project: project.slug }).filter(
    (e) => e.data.status === "todo" || e.data.status === "in-progress",
  );
  const lines = [
    `project: ${project.slug}`,
    `category: ${project.category}`,
    project.language ? `language: ${project.language}` : null,
    "",
    "active entries:",
    ...(active.length === 0
      ? ["  (none)"]
      : active.map(
          (e) =>
            `  - ${e.pointer.type}/${e.pointer.id} (${e.data.status})`,
        )),
  ].filter((l) => l !== null);
  return { additionalContext: wrap(lines.join("\n")) };
}

function wrap(content) {
  return `<archievement-context>\n${content}\n</archievement-context>`;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write the bash wrapper `hooks/session-start`**

Read `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/hooks/session-start` for reference on the JSON wire format Claude Code expects on stdin/stdout. Then write our wrapper:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Read stdin (a JSON object Claude Code passes in)
INPUT=$(cat)

# Extract cwd (with jq if available, fallback to grep+sed)
if command -v jq >/dev/null 2>&1; then
  CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
else
  CWD=$(echo "$INPUT" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
fi

# Fall back to the current directory if cwd was empty
if [ -z "${CWD:-}" ]; then
  CWD=$(pwd)
fi

PLUGIN_ROOT=${CLAUDE_PLUGIN_ROOT:-"$(cd "$(dirname "$0")/.." && pwd)"}

# Execute the Node helper; capture its JSON output
ADDITIONAL_CONTEXT=$(node --input-type=module -e "
import { runSessionStart } from '${PLUGIN_ROOT}/lib/hooks/session-start.js';
const out = await runSessionStart({ cwd: '${CWD}', now: new Date().toISOString().slice(0, 10) });
process.stdout.write(out.additionalContext);
")

# If empty, just exit silently
if [ -z "$ADDITIONAL_CONTEXT" ]; then
  exit 0
fi

# Emit hook response JSON
jq -n --arg ctx "$ADDITIONAL_CONTEXT" '{"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": $ctx}}'
```

(If `jq` is not present on the user's machine, this falls back gracefully because the dependency is only used for envelope construction at the end. Verify by reading superpowers' session-start which handles the same case.)

- [ ] **Step 6: Make it executable and commit**

```bash
chmod +x hooks/session-start
git add hooks/session-start lib/hooks/session-start.js test/hooks/session-start.test.js
git rm lib/hooks/.gitkeep test/hooks/.gitkeep
git commit -m "Add SessionStart hook with Node-driven context injection"
```

---

### Task 32: PostToolUse hook for `gh pr create`

**Files:**
- Create: `hooks/post-tool-use-gh-pr-create` (bash)
- Create: `lib/hooks/post-pr-create.js`
- Create: `test/hooks/post-pr-create.test.js`

This hook fires on every `Bash` tool use. The Node helper inspects the tool input: if the bash command was `gh pr create ...`, parse the tool output to extract PR URL/number/title and emit an `additionalContext` nudge. Otherwise emit empty (silent).

- [ ] **Step 1: Write the test**

```javascript
// test/hooks/post-pr-create.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { runPostPrCreate } from "../../lib/hooks/post-pr-create.js";

test("runPostPrCreate returns empty when tool was not gh pr create", async () => {
  const out = await runPostPrCreate({
    tool_name: "Bash",
    tool_input: { command: "ls -la" },
    tool_output: "some files\n",
  });
  assert.equal(out.additionalContext, "");
});

test("runPostPrCreate extracts PR URL from gh pr create output", async () => {
  const out = await runPostPrCreate({
    tool_name: "Bash",
    tool_input: { command: 'gh pr create --title "foo" --body "bar"' },
    tool_output: "https://github.com/AgenticFish/archievement/pull/42\n",
  });
  assert.match(out.additionalContext, /<archievement-nudge>/);
  assert.match(out.additionalContext, /PR #42/);
  assert.match(out.additionalContext, /https:\/\/github\.com\/AgenticFish\/archievement\/pull\/42/);
  assert.match(out.additionalContext, /\/archievement:record/);
});

test("runPostPrCreate returns empty when output has no PR URL", async () => {
  const out = await runPostPrCreate({
    tool_name: "Bash",
    tool_input: { command: "gh pr create --title foo" },
    tool_output: "error: something failed\n",
  });
  assert.equal(out.additionalContext, "");
});

test("runPostPrCreate ignores non-Bash tools", async () => {
  const out = await runPostPrCreate({
    tool_name: "Read",
    tool_input: { file_path: "/etc/passwd" },
    tool_output: "",
  });
  assert.equal(out.additionalContext, "");
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/hooks/post-pr-create.js`**

```javascript
// lib/hooks/post-pr-create.js

/**
 * @typedef {{
 *   tool_name: string,
 *   tool_input: { command?: string },
 *   tool_output: string,
 * }} PostPrCreateInput
 *
 * @typedef {{ additionalContext: string }} PostPrCreateOutput
 */

const PR_URL_RE = /https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/(\d+)/;

/**
 * @param {PostPrCreateInput} input
 * @returns {Promise<PostPrCreateOutput>}
 */
export async function runPostPrCreate(input) {
  if (input.tool_name !== "Bash") {
    return { additionalContext: "" };
  }
  const cmd = input.tool_input?.command ?? "";
  if (!/^\s*gh\s+pr\s+create\b/.test(cmd)) {
    return { additionalContext: "" };
  }
  const match = (input.tool_output ?? "").match(PR_URL_RE);
  if (!match) {
    return { additionalContext: "" };
  }
  const [url, number] = [match[0], match[1]];
  return {
    additionalContext: `<archievement-nudge>\nPR #${number} created at ${url}. Invoke /archievement:record to save its summary into archievement.\n</archievement-nudge>`,
  };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write the bash wrapper `hooks/post-tool-use-gh-pr-create`**

```bash
#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)
PLUGIN_ROOT=${CLAUDE_PLUGIN_ROOT:-"$(cd "$(dirname "$0")/.." && pwd)"}

ADDITIONAL_CONTEXT=$(node --input-type=module -e "
import { runPostPrCreate } from '${PLUGIN_ROOT}/lib/hooks/post-pr-create.js';
const raw = ${INPUT@Q};
const data = JSON.parse(raw);
const out = await runPostPrCreate({
  tool_name: data.tool_name ?? '',
  tool_input: data.tool_input ?? {},
  tool_output: data.tool_response?.output ?? data.tool_response ?? '',
});
process.stdout.write(out.additionalContext);
")

if [ -z "$ADDITIONAL_CONTEXT" ]; then
  exit 0
fi

jq -n --arg ctx "$ADDITIONAL_CONTEXT" '{"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": $ctx}}'
```

Note: bash `${var@Q}` is a portable-ish way to single-quote a string for safe embedding in a Node `-e` script. If targeting truly old bash, fall back to writing INPUT to a tempfile and reading it from Node.

- [ ] **Step 6: Make it executable and commit**

```bash
chmod +x hooks/post-tool-use-gh-pr-create
git add hooks/post-tool-use-gh-pr-create lib/hooks/post-pr-create.js test/hooks/post-pr-create.test.js
git commit -m "Add PostToolUse hook nudging user to save PR summary"
```

---

### Task 33: Verify hooks are executable on a clean checkout

Git preserves the executable bit. This task is a guard: in the CI workflow we already shellcheck `hooks/*` (Task 4). Here we add a one-off test asserting the bit is present, so a future commit that loses it is caught immediately.

**Files:**
- Create: `test/hooks/executable-bit.test.js`

- [ ] **Step 1: Write the test**

```javascript
// test/hooks/executable-bit.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { statSync, constants } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOKS = ["session-start", "post-tool-use-gh-pr-create"];

test("every hook bash script is executable by the user", () => {
  for (const name of HOOKS) {
    const path = join(HERE, "..", "..", "hooks", name);
    const mode = statSync(path).mode;
    // owner execute bit
    assert.ok(
      (mode & constants.S_IXUSR) !== 0,
      `${name}: user execute bit not set (mode=${mode.toString(8)})`,
    );
  }
});
```

- [ ] **Step 2: Run, expect pass**

Run: `npm test`
Expected: PASS (the previous tasks already chmod +x'd both scripts).

- [ ] **Step 3: Commit**

```bash
git add test/hooks/executable-bit.test.js
git commit -m "Add guard test for hook executable bit"
```

---

## Section 8 — Polish

### Task 34: README

**Files:**
- Create: `README.md` (overwriting nothing — there is no README yet)

- [ ] **Step 1: Write `README.md`**

```markdown
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
```

- [ ] **Step 2: Format the README to confirm Prettier won't complain**

Run: `npm run format:check`
Expected: PASS (README is excluded by `.prettierignore`).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Add README with install, usage, and design pointer"
```

---

### Task 35: End-to-end smoke test (manual)

This task is human-driven; the goal is to walk the full plugin once on real Claude Code to catch packaging issues that unit tests cannot.

- [ ] **Step 1: Register the plugin locally**

Add the plugin to your Claude Code plugin marketplace config (the same way you add other plugins). Open a fresh Claude Code session.

- [ ] **Step 2: Run setup**

Invoke `/archievement:setup` in Claude Code. Confirm:
- It asks where the folder should live.
- It asks the default language with dynamically-built options (e.g., `中文 / English` if your previous messages were in Chinese).
- After completion, `~/archievement/` exists with the directory skeleton and three config files.
- `~/.archievementrc` contains the absolute path.

- [ ] **Step 3: Register a project**

`cd` into any git-tracked project. Open a new Claude Code session. Verify the SessionStart hook injected an "unregistered project" notice.

Invoke any archievement skill (e.g., `/archievement:record`). It should AskUserQuestion to register the project. Pick a category and confirm. Verify `archievement/config/projects.yml` updated.

- [ ] **Step 4: Create an entry**

Walk through `/archievement:record` to create a brand-new `idea`. Verify the file landed under `archievement/<category>/ideas/<slug>.md` with correct frontmatter.

- [ ] **Step 5: Promote it**

`/archievement:promote` the idea to a `ticketed` entry with a made-up ticket ID. Verify:
- New entry exists at `archievement/<category>/ticketed/<id>/index.md`.
- Old idea file has `status: done` and `promoted_to: <category>/ticketed/<id>`.
- New entry has `promoted_from: <category>/idea/<slug>`.

- [ ] **Step 6: Generate a summary report**

`/archievement:report` → `summary`. Verify a file appears at `archievement/reports/<timestamp>-summary.md` listing the active ticketed entry.

- [ ] **Step 7: Generate a perf-review (work category)**

Create at least one `done` ticketed entry first (set status manually). Then `/archievement:report` → `perf-review` → `work`. Verify:
- The report appears at `archievement/reports/perf-review/<timestamp>-work.md`.
- Personal entries are NOT mentioned (cross-check by adding a personal entry and re-running — it should still not appear).
- The Anchors section has a number that matches what you'd compute by hand.

- [ ] **Step 8: Document anything broken**

If any step surfaces an issue, file a `personal/ideas/archievement-followup-<topic>.md` entry — through the plugin itself, because that's the point.

(No commit for this task; nothing changed in the repo.)

---

### Task 36: Final consistency review

A read-through pass to catch inconsistencies before merging the whole thing.

- [ ] **Step 1: Verify all SKILL.md descriptions match what spec §3.1 promises**

Open each `skills/*/SKILL.md` and re-read the description against the spec's Skill table. They should line up.

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: all tests pass. Capture the count and confirm it includes the skills sanity test, hooks tests, every `lib/` test, and the entry/promote/report tests.

- [ ] **Step 3: Run formatting checks**

```bash
npm run format:check
shellcheck hooks/session-start hooks/post-tool-use-gh-pr-create
```

Expected: no errors.

- [ ] **Step 4: Verify CI ran on the most recent PR**

Visit the PR on GitHub. Confirm both `format` and `test` jobs are green.

- [ ] **Step 5: Sanity check the on-disk shape**

```bash
find archievement -type f | head -20   # in a test workspace where you ran setup
```

Cross-reference the paths against the directory layout in spec §2 and this plan's file structure section. Any unexpected file is a bug.

- [ ] **Step 6: Final commit (if any) and PR**

If the review surfaced fixes, commit them with focused messages and push. The plan is done when this task is checked.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-23-archievement-implementation.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?






