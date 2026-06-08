# Project Slug in Filename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encode the owning project into every entry id as `<project-slug>_<entry-slug>` so a filename is self-describing, while keeping the directory layout (`category`/`type`) unchanged.

**Architecture:** Rewrite `slugOf` in `lib/entries/path.js` to parse the id in two stages (strip `project_`, then for ticketed strip the ticket prefix), and add two new pure helpers — `projectOf` (read the project segment) and `makeId` (construct `project_entry`, defaulting an empty project to `tbd`). The `record` skill builds new-entry ids through `makeId`. `promote` and `find` skill prose is updated to describe the new id shape. No JS outside `path.js` changes: `orchestrate.js` and `prediction-status.js` only *call* `slugOf`, so the relaxed promote behavior (project may change, entry-slug preserved) follows automatically. This is a **clean break** — parsing assumes the new `<project>_<slug>` shape unconditionally, no legacy fallback.

**Tech Stack:** Node.js 20+ ESM, plain JS + JSDoc, `node:test` runner, Prettier.

**Spec:** [`docs/superpowers/specs/2026-06-07-project-slug-in-filename-design.md`](../specs/2026-06-07-project-slug-in-filename-design.md)

---

## Prerequisites

- [ ] **PR #33 (remove-legacy-config-migration) is merged to main.** This plan starts from a clean `loadConfig`. Confirm with `git log main --oneline | grep "Remove legacy config-migration"`.
- [ ] Branch off the latest main: `git checkout main && git pull && git checkout -b project-slug-in-filename`.

## Background the implementer needs

**The id is the primary key.** `lib/entries/path.js` builds every on-disk path by interpolating `ptr.id` verbatim into `<root>/<category>/<type>/<id>.md` (file-layout) or `.../<id>/index.md` (dir-layout). Changing the id encoding therefore changes filenames but **not** the directory structure. Do not touch `entryFilePath` / `entryDirPath` / `entryIndexPath` / `locateEntry` — they stay byte-for-byte identical.

**What `slugOf` is for.** It extracts the cross-promote *identity* of an entry. `promote()` (in `lib/promote/orchestrate.js:26`) enforces `slugOf(from) === slugOf(to)` so that graduating an entry can change its category/type/ticket but never silently rename it. `resolveStatus()` (in `lib/reports/prediction-status.js:77,79`) uses `slugOf` to locate "the entry currently carrying this slug" across idea/graduated forms. These are the **only two callers of `slugOf` in `lib/`** (verified by grep). Everything else treats the id as an opaque string.

**The new encoding (from the spec):**

```
id = <project-slug> "_" <entry-slug>
```

- `_` is the sole delimiter, appearing exactly once. Split on the **first** `_`.
- Both segments may contain `-` but never `_`.
- No-project entries use the literal `tbd` as the project segment.
- Ticketed entries keep `<TICKET>-<slug>` in the entry-slug segment, e.g. `egs-mobile_EGA-5971-voice-refactor`.
- A ticket with no slug suffix is valid: `egs-mobile_EGA-5971`.

**Two-stage `slugOf`:**

```
egs-mobile_EGA-5971-voice-refactor
  (1) strip everything up to & including the first "_"  → EGA-5971-voice-refactor
  (2) if ticketed, strip /^[A-Z][A-Z0-9]*-\d+-/         → voice-refactor
```

For non-ticketed types stage 2 is a no-op, so `slugOf` returns the entry-slug segment as-is.

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `lib/entries/path.js` | id ↔ path + id parsing | **Core** — rewrite `slugOf`; add `projectOf`, `makeId` |
| `test/entries/path.test.js` | unit tests for path.js | **Core** — rewrite `slugOf` suite; add `projectOf`/`makeId` suites |
| `skills/record/SKILL.md` | new-entry creation prose | **Core** — build id via `makeId`; project from SessionStart slug else `tbd` |
| `skills/promote/SKILL.md` | promote prose | Follow — target-id construction; promote may fill in/change project |
| `skills/find/SKILL.md` | recall prose | Follow — note id carries a `project_` prefix; may group by `projectOf` |
| `test/promote/orchestrate.test.js` | promote integration tests | Test — update id fixtures to `<project>_<slug>` shape |
| `test/promote/move.test.js` | move integration tests | Test — update id fixtures (only those asserting on slug identity) |
| `test/reports/prediction-status.test.js` | status-table resolver tests | Test — update id fixtures that exercise `resolveStatus`/`slugOf` |
| `docs/superpowers/specs/2026-06-07-project-slug-in-filename-design.md` | the spec | Mark status `accepted`; record impl date |

**Explicitly NOT changed** (the spec's "Unchanged by design" list, verified against the code): `lib/entries/create.js`, `list.js`, `read.js`, `update.js`, `lib/promote/move.js`, `orchestrate.js`, `lib/hooks/session-start.js`, and the directory structure. `orchestrate.js` and `prediction-status.js` get their new behavior purely from the rewritten `slugOf`.

---

## Task 1: Rewrite `slugOf` for the two-stage encoding

**Files:**
- Modify: `lib/entries/path.js:56-73` (the `slugOf` JSDoc + function)
- Test: `test/entries/path.test.js:68-85` (the existing `slugOf` suite — rewritten)

The existing `slugOf` suite uses **bare ids without a project segment** (`foo-bar`, `EGA-5971-voice-refactor`), which no longer occur under the new encoding. Rewrite the suite first (TDD), watch it fail, then rewrite the function.

- [ ] **Step 1: Replace the `slugOf` test suite with the new-encoding cases**

In `test/entries/path.test.js`, delete the four existing `slugOf` tests (lines 68-85, from `test("slugOf: idea/unticketed/learning id is the slug verbatim"...` through the `legacy ticketed id` test) and replace them with:

```javascript
test("slugOf: non-ticketed strips only the project segment", () => {
  assert.equal(slugOf({ type: "idea", id: "tbd_mcp-transport-stdio-vs-http" }), "mcp-transport-stdio-vs-http");
  assert.equal(slugOf({ type: "unticketed", id: "archievement-plugin_find-skill" }), "find-skill");
  assert.equal(slugOf({ type: "learning", id: "tbd_magnifica-humanitas" }), "magnifica-humanitas");
});

test("slugOf: ticketed strips the project segment then the TICKET- prefix", () => {
  assert.equal(slugOf({ type: "ticketed", id: "egs-mobile_EGA-5971-voice-refactor" }), "voice-refactor");
  assert.equal(slugOf({ type: "ticketed", id: "archievement-plugin_PROJ-123-add-foo-bar" }), "add-foo-bar");
});

test("slugOf: ticketed slug may itself start with a digit", () => {
  assert.equal(slugOf({ type: "ticketed", id: "egs-mobile_PROJ-123-2023-retro" }), "2023-retro");
});

test("slugOf: ticketed id with no slug suffix returns the bare ticket", () => {
  // project stripped → EGA-5971; ticket-prefix regex needs a trailing slug to strip,
  // finds none, so EGA-5971 is returned unchanged.
  assert.equal(slugOf({ type: "ticketed", id: "egs-mobile_EGA-5971" }), "EGA-5971");
});

test("slugOf: tbd project segment is stripped like any other", () => {
  assert.equal(slugOf({ type: "idea", id: "tbd_foo" }), "foo");
});

test("slugOf: an entry-slug containing hyphens survives intact", () => {
  assert.equal(slugOf({ type: "unticketed", id: "archievement-plugin_a-b-c-d" }), "a-b-c-d");
});
```

- [ ] **Step 2: Run the suite to verify it fails**

Run: `npm test 2>&1 | grep -A3 "slugOf"`
Expected: the new tests FAIL — e.g. `slugOf({ type: "idea", id: "tbd_mcp-transport-stdio-vs-http" })` returns the full `tbd_mcp-transport-stdio-vs-http` (old `slugOf` returns the id verbatim for non-ticketed) instead of `mcp-transport-stdio-vs-http`.

- [ ] **Step 3: Rewrite `slugOf` to strip the project segment first**

Replace `lib/entries/path.js:56-73` (the JSDoc block + function) with:

```javascript
/**
 * Extract the stable entry-slug from an entry pointer — the cross-promote
 * identity. Every id is encoded `<project-slug>_<entry-slug>` (the project
 * segment is `tbd` when unclassified), so parsing is two-stage:
 *
 *   (1) strip the project segment: everything up to and including the first `_`.
 *   (2) for `ticketed` only, strip the leading `^[A-Z][A-Z0-9]*-\d+-` ticket
 *       prefix (e.g. `EGA-5971-voice-refactor` → `voice-refactor`). A ticket
 *       with no slug suffix (`EGA-5971`) has no prefix to strip and is returned
 *       as-is.
 *
 * Because the project segment is removed before comparison, promote may change
 * the project while preserving the entry-slug. Clean break: ids are assumed to
 * carry the `_` delimiter; there is no pre-convention fallback.
 *
 * @param {{ type: EntryType, id: string }} ptr
 * @returns {string}
 */
export function slugOf(ptr) {
  const entrySlug = ptr.id.slice(ptr.id.indexOf("_") + 1);
  if (ptr.type === "ticketed") {
    return entrySlug.replace(/^[A-Z][A-Z0-9]*-\d+-/, "");
  }
  return entrySlug;
}
```

Note: `indexOf("_")` returns the index of the **first** `_`; `slice(idx + 1)` takes everything after it. If an id somehow had no `_`, `indexOf` returns `-1` and `slice(0)` returns the whole id — acceptable degenerate behavior, but `makeId` (Task 3) guarantees a `_` is always present for ids the plugin creates.

- [ ] **Step 4: Run the suite to verify it passes**

Run: `npm test 2>&1 | grep -A3 "slugOf"`
Expected: all six `slugOf` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/entries/path.js test/entries/path.test.js
git commit -m "Rewrite slugOf for two-stage <project>_<slug> id parsing"
```

---

## Task 2: Add `projectOf`

**Files:**
- Modify: `lib/entries/path.js` (add after `slugOf`)
- Test: `test/entries/path.test.js` (add after the `slugOf` suite)

- [ ] **Step 1: Write the failing test**

In `test/entries/path.test.js`, add `projectOf` to the import on lines 7-14 (insert it into the destructured list, e.g. after `slugOf,`), then add this suite after the `slugOf` tests:

```javascript
test("projectOf returns the project segment before the first underscore", () => {
  assert.equal(projectOf({ id: "archievement-plugin_find-skill" }), "archievement-plugin");
  assert.equal(projectOf({ id: "egs-mobile_EGA-5971-voice-refactor" }), "egs-mobile");
});

test("projectOf returns 'tbd' for the unclassified placeholder", () => {
  assert.equal(projectOf({ id: "tbd_mcp-transport-stdio-vs-http" }), "tbd");
});

test("projectOf returns the project even when the entry-slug has hyphens", () => {
  assert.equal(projectOf({ id: "archievement-plugin_a-b-c-d" }), "archievement-plugin");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test 2>&1 | grep -A3 "projectOf"`
Expected: FAIL — `projectOf` is not exported (`projectOf is not a function` / import is `undefined`).

- [ ] **Step 3: Implement `projectOf`**

In `lib/entries/path.js`, add immediately after the `slugOf` function:

```javascript
/**
 * Extract the project segment from an entry id — everything before the first
 * `_`. Every id has a project segment by construction (`tbd` at minimum), so
 * this always returns a non-empty string. Used by find / reports to display or
 * group entries by project ownership.
 *
 * @param {{ id: string }} ptr
 * @returns {string}
 */
export function projectOf(ptr) {
  return ptr.id.slice(0, ptr.id.indexOf("_"));
}
```

Note: when `_` is at index `n`, `slice(0, n)` returns the project segment without the underscore. (If `_` were absent, `indexOf` returns `-1` and `slice(0, -1)` drops the last char — a degenerate case that `makeId` prevents for plugin-created ids.)

- [ ] **Step 4: Run to verify it passes**

Run: `npm test 2>&1 | grep -A3 "projectOf"`
Expected: all three `projectOf` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/entries/path.js test/entries/path.test.js
git commit -m "Add projectOf helper to read the id project segment"
```

---

## Task 3: Add `makeId`

**Files:**
- Modify: `lib/entries/path.js` (add after `projectOf`)
- Test: `test/entries/path.test.js` (add after the `projectOf` suite)

`makeId` is the single construction point for ids, so `record`/`promote` never hand-concatenate. It defaults a falsy project to `tbd` and rejects a `_` in either segment (the delimiter must be unambiguous).

- [ ] **Step 1: Write the failing test**

Add `makeId` to the import in `test/entries/path.test.js`, then add:

```javascript
test("makeId joins project and entry slug with a single underscore", () => {
  assert.equal(makeId("egs-mobile", "EGA-5971"), "egs-mobile_EGA-5971");
  assert.equal(makeId("archievement-plugin", "find-skill"), "archievement-plugin_find-skill");
});

test("makeId defaults a falsy project to the tbd placeholder", () => {
  assert.equal(makeId("", "foo"), "tbd_foo");
  assert.equal(makeId(null, "foo"), "tbd_foo");
  assert.equal(makeId(undefined, "foo"), "tbd_foo");
});

test("makeId rejects an underscore in either segment", () => {
  assert.throws(() => makeId("ar_chievement", "foo"), /underscore/);
  assert.throws(() => makeId("archievement-plugin", "foo_bar"), /underscore/);
});

test("makeId round-trips through projectOf and slugOf for a non-ticketed id", () => {
  const id = makeId("archievement-plugin", "find-skill");
  assert.equal(projectOf({ id }), "archievement-plugin");
  assert.equal(slugOf({ type: "unticketed", id }), "find-skill");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test 2>&1 | grep -A3 "makeId"`
Expected: FAIL — `makeId` is not exported.

- [ ] **Step 3: Implement `makeId`**

In `lib/entries/path.js`, add immediately after `projectOf`:

```javascript
/**
 * Construct an entry id from a project slug and an entry slug:
 * `<project>_<entry>`. A falsy/empty project yields the `tbd` placeholder.
 * Neither segment may contain `_` (the sole delimiter) — `makeId` throws if it
 * does, so a malformed id can never reach disk. `record`/`promote` use
 * kebab-case slugs (hyphens only), so this holds by construction.
 *
 * @param {string | null | undefined} projectSlug
 * @param {string} entrySlug
 * @returns {string}
 */
export function makeId(projectSlug, entrySlug) {
  const project = projectSlug || "tbd";
  if (project.includes("_") || entrySlug.includes("_")) {
    throw new Error(
      `makeId: neither segment may contain an underscore (project='${project}', entry='${entrySlug}')`,
    );
  }
  return `${project}_${entrySlug}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test 2>&1 | grep -A3 "makeId"`
Expected: all four `makeId` tests PASS.

- [ ] **Step 5: Run the whole path suite + format**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"` and `npm run format:check`
Expected: all pass; formatting clean. (If format flags `path.js` or `path.test.js`, run `npm run format` and re-stage.)

- [ ] **Step 6: Commit**

```bash
git add lib/entries/path.js test/entries/path.test.js
git commit -m "Add makeId helper enforcing the single-underscore id delimiter"
```

---

## Task 4: Add a promote-preservation-across-project-change test

**Files:**
- Test: `test/entries/path.test.js` (add after the `makeId` suite)

This is the **key invariant** of the whole feature (spec §4.2, §5): promote's slug check passes even when the project segment changes, because `slugOf` strips the project before comparing. There is no production code change in this task — it locks the cross-cutting behavior with a dedicated test so a future refactor of `slugOf` can't silently break promote.

- [ ] **Step 1: Write the test**

```javascript
test("slugOf preservation holds across a project change (promote graduation)", () => {
  // tbd_foo (idea) graduates to archievement-plugin_foo (unticketed):
  // the project segment changes but the entry-slug is preserved, so promote's
  // slugOf(from) === slugOf(to) check passes.
  const from = { type: "idea", id: "tbd_foo" };
  const to = { type: "unticketed", id: "archievement-plugin_foo" };
  assert.equal(slugOf(from), slugOf(to));
  assert.equal(slugOf(from), "foo");
});

test("slugOf preservation holds when an idea graduates to a ticket", () => {
  // tbd_voice-refactor (idea) → egs-mobile_EGA-5971-voice-refactor (ticketed):
  // project filled in AND a ticket prefix added; entry-slug still 'voice-refactor'.
  const from = { type: "idea", id: "tbd_voice-refactor" };
  const to = { type: "ticketed", id: "egs-mobile_EGA-5971-voice-refactor" };
  assert.equal(slugOf(from), slugOf(to));
  assert.equal(slugOf(from), "voice-refactor");
});
```

- [ ] **Step 2: Run to verify it passes immediately**

Run: `npm test 2>&1 | grep -A3 "preservation"`
Expected: both PASS (the behavior already follows from Task 1's `slugOf`). This test documents and guards the invariant; it is green by construction.

- [ ] **Step 3: Commit**

```bash
git add test/entries/path.test.js
git commit -m "Lock promote slug-preservation across project change with a test"
```

---

## Task 5: Update promote integration-test fixtures

**Files:**
- Test: `test/promote/orchestrate.test.js`
- Test: `test/promote/move.test.js`

`orchestrate.js` calls `slugOf(from)` / `slugOf(to)`. Any test that constructs a `from`/`to` pointer pair and expects the promote to **succeed** must now use ids whose entry-slugs match under the new `slugOf`. Tests that expect promote to **reject** a slug mismatch must still produce a mismatch under the new parsing.

- [ ] **Step 1: Read both files and inventory the id fixtures**

Run:
```bash
grep -nE "id: \"|slugOf|slug" test/promote/orchestrate.test.js test/promote/move.test.js
```
For each `from`/`to` pair, decide the new ids:
- A previously-passing promote like `from idea id:"voice-refactor"` → `to ticketed id:"EGA-5971-voice-refactor"` becomes `from id:"tbd_voice-refactor"` → `to id:"egs-mobile_EGA-5971-voice-refactor"` (or any project segments; the entry-slugs must match under `slugOf`).
- A mismatch test like `from id:"foo"` → `to id:"bar"` becomes `from id:"tbd_foo"` → `to id:"tbd_bar"` (still mismatched: `slugOf` → `foo` ≠ `bar`).

- [ ] **Step 2: Rewrite each id literal to the `<project>_<entry>` shape**

Apply the decisions from Step 1. Keep the **assertions** meaningful: where a test asserts on the resulting `target.path` or `target.pointer.id`, update the expected string to include the project segment (e.g. expected path `.../unticketed/archievement-plugin_foo.md` not `.../unticketed/foo.md`). Where a test asserts the promote **throws** on slug mismatch, confirm the new ids still mismatch under `slugOf` and the error message (`promote must preserve the slug: 'X' (source) != 'Y' (target)`) now interpolates the stripped entry-slugs.

- [ ] **Step 3: Run the promote suites**

Run: `npm test 2>&1 | grep -iE "promote|orchestrate|move|graduat" `
Expected: all promote/move tests PASS. If a "throws on mismatch" test now unexpectedly passes the slug check, your two ids share an entry-slug — pick genuinely different entry-slugs.

- [ ] **Step 4: Commit**

```bash
git add test/promote/orchestrate.test.js test/promote/move.test.js
git commit -m "Update promote test fixtures to <project>_<slug> ids"
```

---

## Task 6: Update prediction-status resolver fixtures

**Files:**
- Test: `test/reports/prediction-status.test.js`

`resolveStatus(entries, slug)` (in `prediction-status.js:77,79`) does `slugOf(e.pointer) === slug`. Its `slug` argument is the value in the status-table's `id` column, which is the **entry-slug** (not the full id). Under the new encoding, `listEntries` returns entries whose `pointer.id` is `<project>_<entry>`, and `slugOf` strips that to the entry-slug. So the fixtures must: (a) give entries new-shape `pointer.id`s, and (b) call `resolveStatus(entries, "<entry-slug>")` with the bare entry-slug.

- [ ] **Step 1: Read the file and find the `resolveStatus` / pointer-id fixtures**

Run:
```bash
grep -nE "id: \"|resolveStatus|pointer|slug" test/reports/prediction-status.test.js
```
Identify (a) any synthetic entry objects with `pointer: { ..., id: "..." }` and (b) every `resolveStatus(entries, "...")` call.

- [ ] **Step 2: Rewrite the entry pointer ids and the resolveStatus slug args**

For each synthetic entry, change `id: "mcp-transport"` → `id: "tbd_mcp-transport"` (idea) or `id: "archievement-plugin_mcp-transport"` (graduated unticketed) etc. — pick project segments that make the test's intent clear (e.g. an idea that graduated keeps the **same entry-slug** but may gain a real project). For each `resolveStatus(entries, X)` call, `X` must be the **entry-slug** (`"mcp-transport"`), because that is what `slugOf` now returns and what the status-table id column holds.

Example transformation:
```javascript
// before
const entries = [
  { pointer: { type: "idea", id: "mcp-transport" }, data: { status: "todo" } },
];
assert.equal(resolveStatus(entries, "mcp-transport"), "todo");

// after — entry id carries the project; resolveStatus is still queried by entry-slug
const entries = [
  { pointer: { type: "idea", id: "tbd_mcp-transport" }, data: { status: "todo" } },
];
assert.equal(resolveStatus(entries, "mcp-transport"), "todo");

// after — graduated case: same entry-slug, project filled in; status comes from the graduated entry
const entries2 = [
  { pointer: { type: "unticketed", id: "archievement-plugin_mcp-transport" }, data: { status: "done" } },
];
assert.equal(resolveStatus(entries2, "mcp-transport"), "done");
```

- [ ] **Step 3: Run the prediction-status suite**

Run: `npm test 2>&1 | grep -iE "status|resolveStatus|prediction"`
Expected: all prediction-status tests PASS. A `"removed"` test (slug exists nowhere) should still return `"removed"` — confirm its query slug matches no entry's `slugOf`.

- [ ] **Step 4: Commit**

```bash
git add test/reports/prediction-status.test.js
git commit -m "Update prediction-status fixtures to <project>_<slug> ids"
```

---

## Task 7: Full test sweep — catch any remaining id-shape assertions

**Files:**
- Test: any file `npm test` flags

The other report/entry test suites (`summary`, `completion`, `stats`, `perf-review`, `list`, `read`, `update`, `create`, `expand`, `session-start`, `bash-portability`) treat the id as an opaque display string, so most will still pass with their existing bare ids. But any test that **asserts on a rendered id string** (e.g. `assert.match(report, /mcp-transport/)`) is unaffected, while any that asserts a **full path** built from an id is also unaffected (paths interpolate the id verbatim). This task is a safety sweep: run everything, fix only what actually breaks.

- [ ] **Step 1: Run the entire suite**

Run: `npm test 2>&1 | grep -E "^(ℹ (tests|pass|fail)|not ok|✖)"`
Expected ideal: `pass N`, `fail 0`. If `fail 0`, skip to Step 3.

- [ ] **Step 2: Fix each genuine failure**

For every failure, read the test. Decide:
- If it constructs an id and asserts on promote/slug behavior → update the id to `<project>_<slug>` shape (same logic as Tasks 5-6).
- If it asserts on a literal id/path string that you changed in an upstream fixture → update the expected string.
- **Do NOT** change production code to make a test pass. The only production changes in this whole plan are the three functions in `path.js` (Tasks 1-3). If a test seems to demand a `lib/` change outside `path.js`, STOP and flag it — the spec says no other `lib/` file changes, so a demand for one means either the test or your understanding is wrong.

- [ ] **Step 3: Verify green + formatted**

Run: `npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"` then `npm run format:check`
Expected: `fail 0`; "All matched files use Prettier code style!". Run `npm run format` if needed and re-stage.

- [ ] **Step 4: Commit (only if Step 2 changed anything)**

```bash
git add -A
git commit -m "Update remaining test fixtures for <project>_<slug> ids"
```

---

## Task 8: Update the `record` skill to build ids via `makeId`

**Files:**
- Modify: `skills/record/SKILL.md:48-56` (the "If creating a new entry" flow, steps 3b-3h)

`record` is where new ids are minted. It must build the id as `<project>_<entry-slug>`, taking the project from the SessionStart `<archievement-context>` slug when present, else `tbd`. The skill is prose (the LLM follows it at runtime), so the change is instructional, not code — but it must name `makeId` and the `tbd` fallback explicitly so the runtime never hand-concatenates.

- [ ] **Step 1: Read the current create-flow steps**

Re-read `skills/record/SKILL.md` lines 48-56 (step 3). Note that step 3c currently says "For `ticketed`: ask the ticket ID. For others: ask a slug (kebab-case)." and step 3h calls `createEntry`.

- [ ] **Step 2: Rewrite step 3c and add an id-construction step**

Replace step 3c (line 51) and insert a new construction step. The edited block should read:

```markdown
   c. For `ticketed`: ask the ticket ID (free-form, e.g. `EGA-5971`); the **entry-slug** is `<TICKET>-<kebab-slug>` (ask for the kebab-slug too, or derive it from the content with the user's confirmation). For other types: ask a kebab-case entry-slug.
   c2. **Determine the project segment.** If the SessionStart `<archievement-context>` block carries a `project:` slug, use it. Otherwise use the literal `tbd` (the "unclassified for now" placeholder). Do NOT invent a project name.
   c3. **Build the id** with `makeId(project, entrySlug)` from `lib/entries/path.js` — never hand-concatenate. Example:
       `node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/entries/path.js').then(({ makeId }) => process.stdout.write(makeId('PROJECT', 'ENTRY_SLUG')))"`
       For a ticketed entry the second arg is the full `<TICKET>-<slug>` entry-slug, e.g. `makeId('egs-mobile', 'EGA-5971-voice-refactor')` → `egs-mobile_EGA-5971-voice-refactor`. For no project: `makeId('', 'foo')` → `tbd_foo`.
```

- [ ] **Step 3: Make the frontmatter `project` and the id segment agree**

In step 3h (the `createEntry` call), add a sub-note so the project is set consistently in both places:

```markdown
   h. Confirm + save: call `createEntry` from `lib/entries/create.js`. Pass the id built in step c3, and set `extras.project` to the **same** project slug used in the id's project segment (or omit/`tbd` when unclassified) — the filename segment mirrors the authoritative frontmatter `project`.
```

- [ ] **Step 4: Add an invariant about the id encoding**

In the `## Invariants` section (after line 65), add:

```markdown
- **Every new id is `<project>_<entry-slug>`, built via `makeId`.** The project segment mirrors frontmatter `project` (or `tbd` when unclassified). Never put an `_` inside either segment — `makeId` rejects it.
```

- [ ] **Step 5: Verify the skill still passes the shared frontmatter sanity test**

Run: `npm test 2>&1 | grep -iE "SKILL|frontmatter|skills"`
Expected: `each skills/*/SKILL.md has well-formed frontmatter and a body` PASSES (the test validates frontmatter shape, not prose content).

- [ ] **Step 6: Commit**

```bash
git add skills/record/SKILL.md
git commit -m "Build new-entry ids via makeId in the record skill"
```

---

## Task 9: Update the `promote` skill prose

**Files:**
- Modify: `skills/promote/SKILL.md:30` (target-id construction) + `## Invariants` (line 42)

Promote now builds target ids with `makeId`, and — because `slugOf` ignores the project segment — promote **may fill in or change the project** while preserving the entry-slug. The prose currently says only "the slug is preserved"; it must explain the project segment.

- [ ] **Step 1: Rewrite the "Target id" bullet (step 3, line 30)**

Replace the line beginning `- Target id: **the slug is preserved**.` with:

```markdown
   - Target id: **the entry-slug is preserved; the project segment may be filled in or changed.** Build the id with `makeId(project, entrySlug)` from `lib/entries/path.js`. The `entrySlug` must match the source's `slugOf` (promote rejects a different entry-slug). For `ticketed`, the entry-slug is `<TICKET>-<source-slug>` (e.g. source slug `voice-refactor` + ticket `EGA-5971` → entry-slug `EGA-5971-voice-refactor`, full id `egs-mobile_EGA-5971-voice-refactor`). For other types the entry-slug **equals the source slug**. The project segment comes from the target project (e.g. the SessionStart slug) or `tbd`; graduating a `tbd_` idea into a real project is the normal way an idea acquires its project.
```

- [ ] **Step 2: Update the slug-preservation invariant (line 42)**

Replace the `- **promote preserves the slug.**` bullet with:

```markdown
- **promote preserves the entry-slug, not the project.** `slugOf(target) === slugOf(source)` (the project segment is stripped before comparison, so the project may change). Ticketed targets carry `<TICKET>-<slug>` in the entry-slug segment. orchestrate.js enforces this.
```

- [ ] **Step 3: Verify the skill sanity test**

Run: `npm test 2>&1 | grep -iE "SKILL|frontmatter|skills"`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add skills/promote/SKILL.md
git commit -m "Document project-segment handling in the promote skill"
```

---

## Task 10: Update the `find` skill prose

**Files:**
- Modify: `skills/find/SKILL.md` (the "Extract retrieval signals" + "Rank" sections, ~lines 48-88)

`find` should know that ids now carry a `project_` prefix: a filename-keyword search for `find-skill` must still match `archievement-plugin_find-skill`, and results can be grouped/labelled by `projectOf`.

- [ ] **Step 1: Add a note about the id encoding under "Filename / slug keywords"**

In section 1 (around line 52-53), append to the "Filename / slug keywords" bullet:

```markdown
  (Filenames are encoded `<project>_<entry-slug>.md`, so a Glob like `**/*find-skill*.md` matches `archievement-plugin_find-skill.md`. A query naming a project — "the archievement-plugin idea about X" — maps the project to the `<project>_` prefix.)
```

- [ ] **Step 2: Add project-grouping to the "Present results" step**

In section 4 (around line 91-97), add a bullet:

```markdown
- When several hits span different projects, label each with its project
  (the `<project>_` prefix of the filename, available via `projectOf` from
  `lib/entries/path.js`) so the user can disambiguate by ownership.
```

- [ ] **Step 3: Verify the skill sanity test**

Run: `npm test 2>&1 | grep -iE "SKILL|frontmatter|skills"`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add skills/find/SKILL.md
git commit -m "Note project-prefixed ids in the find skill"
```

---

## Task 11: Mark the spec accepted + final verification

**Files:**
- Modify: `docs/superpowers/specs/2026-06-07-project-slug-in-filename-design.md:1-6` (frontmatter)

- [ ] **Step 1: Update the spec status**

Change the frontmatter `status: draft (pending user review)` to `status: implemented (2026-06-08)`.

- [ ] **Step 2: Full green + format gate**

Run:
```bash
npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
npm run format:check
```
Expected: `fail 0`; "All matched files use Prettier code style!".

- [ ] **Step 3: Self-review the diff against the spec**

Run: `git diff main --stat` and confirm the changed files match the File Structure table (path.js + path.test.js + 3 skill .md + 3 test fixtures + spec). No `lib/` file other than `path.js` should appear. If `create.js`/`list.js`/`move.js`/`orchestrate.js`/`session-start.js` show up, investigate — the spec forbids changing them.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-07-project-slug-in-filename-design.md
git commit -m "Mark project-slug-in-filename spec as implemented"
```

---

## Known interaction points & risks (read before executing)

1. **`prediction-status.js` `resolveStatus` is the subtlest dependency.** The spec (§6) lists it as "unchanged," and that is correct *for the JS* — it gets its new behavior from the rewritten `slugOf`. But its correctness depends on a **prose contract**: the prediction report's status-table `id` column must hold the **entry-slug**, not the full `<project>_<entry>` id. If a future prediction report writes the full id into that column, `resolveStatus` will compare `slugOf(pointer)` (= entry-slug) against the full id and always return `"removed"`. Task 6 locks this with fixtures; if you touch `skills/report/SKILL.md` later, ensure the status-table is documented to carry the entry-slug. **This plan does not modify `report` SKILL** — flag it if you discover the status-table prose actually writes full ids.

2. **No data migration — and the new helpers misbehave on old bare ids.** Existing on-disk entries in the user's live archive (`~/IreneXY/archievement`) keep their old bare-id filenames (no `_`). Verified empirically against the Task-1/2 implementations:
   - `slugOf` on old data *coincidentally still works*: an id with no `_` has `indexOf("_") === -1`, so `slice(-1 + 1)` = `slice(0)` = the whole id; for non-ticketed that's the slug, and for an old ticketed `EGA-5971-voice-refactor` the ticket regex then strips `EGA-5971-` → `voice-refactor`. Right by luck.
   - **`projectOf` on old data is WRONG**: `slice(0, indexOf("_"))` = `slice(0, -1)` silently drops the last character — `projectOf({id:"mcp-transport"})` returns `"mcp-transpor"`. This is harmless only because nothing runs `projectOf` over the legacy archive.

   This is acceptable per the spec's clean-break stance (old data is out of scope, not migrated). **Do not add fallback code** to "fix" the degenerate case — that would reintroduce exactly the legacy-compat surface PR #33 just removed. If the user later wants their live archive renamed to the new shape, that is a separate manual task, not part of this plan.

3. **`makeId`'s `_` rejection vs. real slugs.** `record`/`promote` produce kebab-case slugs, so the `_` guard never fires in practice. It exists to fail loudly if a caller ever passes a malformed slug, not as routine validation. Keep the throw.

---

## Self-Review (completed by plan author)

**Spec coverage:** §3 (encoding) → Tasks 1-3; §4 two-stage `slugOf` → Task 1; §4.2 `projectOf` → Task 2; §4.3 `makeId` → Task 3; §4.4 no-legacy → Task 1 (unconditional split, no fallback branch); §5 promote project-change → Task 4 (+ Task 9 prose); §6 affected files → all tasks; `record` → Task 8, `promote` → Task 9, `find` → Task 10; §7 testing (every listed `slugOf`/`projectOf`/`makeId` case) → Tasks 1-3; §7 "other id-constructing tests updated" → Tasks 5-7; §8 invariants → guarded by Tasks 1-4. All spec sections map to a task.

**Type consistency:** `slugOf(ptr)` takes `{ type, id }`; `projectOf(ptr)` takes `{ id }`; `makeId(projectSlug, entrySlug)` returns a string. These signatures are used identically in every task that references them. `EntryType` is the existing exported typedef in `path.js`.

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step shows complete code; every test step shows complete assertions; every command shows the expected result.
