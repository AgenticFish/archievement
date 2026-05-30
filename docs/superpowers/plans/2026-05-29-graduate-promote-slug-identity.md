# Graduate-on-Promote + Slug-as-Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the entry model so `idea` is always a single file, `promote` *graduates* an idea (deletes the source, preserves the slug) instead of preserving an audit trail, and the slug — encoded in every filename — is the sole cross-promote identity.

**Architecture:** The slug becomes the universal identity, recoverable from any filename (`<slug>.md`, or `<TICKET>-<slug>` for ticketed). Promote copies content to the destination then deletes the source; reciprocal `promoted_from`/`promoted_to` links are retired everywhere (move, completion, prediction-status). The prediction status-table resolver stops reading `promoted_to` and instead locates an entry by slug across `idea`/`unticketed`/`ticketed` and reports that entry's *real current* status, or `removed` when the slug is gone.

**Tech Stack:** Node.js 20+ ESM, plain JS + JSDoc, `node:test`, `gray-matter` (via `lib/frontmatter.js`). No new dependencies.

**Tracking entry:** `personal/unticketed/archievement-graduate-promote-slug-identity` in the archievement archive.

**Sectioning:** §1–§5 are code PRs in this source repo (one PR per section, per project convention). §6 is a one-off **data migration run against the archievement *archive*** (`resolveArchievementRoot()`), not a source PR.

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `lib/entries/path.js` | path + identity helpers | **add** `slugOf(ptr)` |
| `lib/entries/create.js` | entry creation | **enforce** `idea` ⇒ file-layout |
| `lib/promote/move.js` | move/copy mechanics | **graduate**: delete source, drop both audit links |
| `lib/promote/orchestrate.js` | promote orchestration | **enforce** slug-preservation invariant |
| `lib/reports/completion.js` | completion report | **remove** the `promoted_to`-driven "Promoted from idea" bucket |
| `lib/reports/prediction-status.js` | status-table resolver | **rewrite** `resolveStatus` to slug-locate + real status + `removed` |
| `skills/promote/SKILL.md` | promote UX | graduate wording; ticketed id = `<TICKET>-<slug>` |
| `skills/report/SKILL.md` | report UX | prediction status semantics wording |
| `docs/superpowers/specs/2026-05-23-archievement-plugin-design.md` | design spec | rewrite audit-trail → graduate; idea-is-file |
| `CLAUDE.md` | repo guide | §4 line: "source preserved" → "graduates (source deleted)" |

Tests mirror each lib file under `test/`.

---

## Task 1: `slugOf()` helper

**Files:**
- Modify: `lib/entries/path.js`
- Test: `test/entries/path.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/entries/path.test.js`:

```js
import { slugOf } from "../../lib/entries/path.js";

test("slugOf: idea/unticketed/learning id is the slug verbatim", () => {
  assert.equal(slugOf({ type: "idea", id: "foo-bar" }), "foo-bar");
  assert.equal(slugOf({ type: "unticketed", id: "foo-bar" }), "foo-bar");
  assert.equal(slugOf({ type: "learning", id: "magnifica-humanitas" }), "magnifica-humanitas");
});

test("slugOf: ticketed strips the leading TICKET- prefix", () => {
  assert.equal(slugOf({ type: "ticketed", id: "EGA-5971-voice-refactor" }), "voice-refactor");
  assert.equal(slugOf({ type: "ticketed", id: "PROJ-123-add-foo-bar" }), "add-foo-bar");
});

test("slugOf: legacy ticketed id with no slug suffix is returned unchanged", () => {
  assert.equal(slugOf({ type: "ticketed", id: "EGA-5971" }), "EGA-5971");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -A2 slugOf`
Expected: FAIL — `slugOf is not a function` / import error.

- [ ] **Step 3: Implement `slugOf`**

Add to `lib/entries/path.js` (after `isDirOnlyType`):

```js
/**
 * Extract the stable slug from an entry pointer. The slug is the cross-promote
 * identity, encoded in the filename. For `ticketed` entries the filename is
 * `<TICKET>-<slug>` (e.g. `EGA-5971-voice-refactor`), so the leading
 * `^[A-Z][A-Z0-9]*-\d+-` ticket prefix is stripped. For every other type the
 * id *is* the slug. A legacy ticketed id with no slug suffix (e.g. `EGA-5971`)
 * has no prefix to strip and is returned unchanged.
 *
 * @param {{ type: EntryType, id: string }} ptr
 * @returns {string}
 */
export function slugOf(ptr) {
  if (ptr.type === "ticketed") {
    return ptr.id.replace(/^[A-Z][A-Z0-9]*-\d+-/, "");
  }
  return ptr.id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test 2>&1 | grep -E "slugOf|fail"`
Expected: the three `slugOf` tests PASS; no new failures.

- [ ] **Step 5: Commit**

```bash
git add lib/entries/path.js test/entries/path.test.js
git commit -m "Add slugOf() to recover the stable slug from any entry pointer"
```

---

## Task 2: Enforce `idea` ⇒ file-layout in `createEntry`

**Files:**
- Modify: `lib/entries/create.js`
- Test: `test/entries/create.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/entries/create.test.js` (uses the existing `withTmpDir`/`TODAY` already imported in that file — if `TODAY` isn't defined there, use the literal `"2026-05-29"`):

```js
test("createEntry rejects dir-layout for type idea", async () => {
  await withTmpDir(async (root) => {
    assert.throws(
      () =>
        createEntry(root, {
          pointer: { category: "personal", type: "idea", id: "seed" },
          layout: "dir",
          extras: {},
          body: "",
          now: "2026-05-29",
        }),
      /idea entries must be file-layout/,
    );
  });
});

test("createEntry still allows file-layout for type idea", async () => {
  await withTmpDir(async (root) => {
    const res = createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "seed" },
      layout: "file",
      extras: {},
      body: "",
      now: "2026-05-29",
    });
    assert.equal(res.layout, "file");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -A2 "dir-layout for type idea"`
Expected: FAIL — no error thrown (dir idea currently allowed).

- [ ] **Step 3: Implement the guard**

In `lib/entries/create.js`, inside `createEntry`, immediately after the existing `locateEntry` "already exists" check (before building `data`), add:

```js
  if (req.pointer.type === "idea" && req.layout === "dir") {
    throw new Error(
      "idea entries must be file-layout; promote graduates an idea into unticketed/ticketed for dir-layout work",
    );
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test 2>&1 | grep -E "type idea|fail"`
Expected: both new tests PASS; no new failures.

- [ ] **Step 5: Commit**

```bash
git add lib/entries/create.js test/entries/create.test.js
git commit -m "Reject dir-layout for idea entries in createEntry"
```

---

## Task 3: Promote graduates the source (delete + drop audit links)

**Files:**
- Modify: `lib/promote/move.js`
- Test: `test/promote/move.test.js`

- [ ] **Step 1: Rewrite the failing tests**

Replace the entire body of `test/promote/move.test.js` with:

```js
// test/promote/move.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { withTmpDir } from "../helpers/tmp.js";
import { createEntry } from "../../lib/entries/create.js";
import { readEntry } from "../../lib/entries/read.js";
import { moveEntry } from "../../lib/promote/move.js";
import { entryFilePath, entryDirPath } from "../../lib/entries/path.js";

const TODAY = "2026-05-23";

test("moveEntry graduates a file-layout entry: target created, source deleted, no audit links", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "spark" },
      layout: "file",
      extras: { seed_date: TODAY },
      body: "An idea.\n",
      now: TODAY,
    });
    const from = created.pointer;
    const to = { category: "personal", type: "unticketed", id: "spark" };

    moveEntry(root, from, to, { now: TODAY, layout: "file" });

    // source is gone (graduated)
    assert.equal(existsSync(entryFilePath(root, from)), false);

    // target exists, carries content, has NO audit links
    const target = readEntry(root, to);
    assert.equal(target.data.type, "unticketed");
    assert.equal(target.data.updated, TODAY);
    assert.equal(target.data.promoted_from, undefined);
    assert.equal(target.data.promoted_to, undefined);
    assert.match(target.body, /An idea/);
  });
});

test("moveEntry throws if target already exists", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "src" },
      layout: "file",
      extras: {},
      body: "src body",
      now: TODAY,
    });
    createEntry(root, {
      pointer: { category: "personal", type: "unticketed", id: "src" },
      layout: "file",
      extras: {},
      body: "dup body",
      now: TODAY,
    });
    assert.throws(
      () =>
        moveEntry(
          root,
          { category: "personal", type: "idea", id: "src" },
          { category: "personal", type: "unticketed", id: "src" },
          { now: TODAY, layout: "file" },
        ),
      /already exists/,
    );
  });
});

test("moveEntry on a dir-layout source copies attachments then deletes the source dir", async () => {
  await withTmpDir(async (root) => {
    const created = createEntry(root, {
      pointer: { category: "work", type: "unticketed", id: "research-foo" },
      layout: "dir",
      extras: { project: "project-a" },
      body: "Research overview.\n",
      now: TODAY,
    });
    // drop a sibling attachment into the source dir
    const srcDir = entryDirPath(root, created.pointer);
    mkdirSync(join(srcDir, "pr-summaries"), { recursive: true });
    writeFileSync(join(srcDir, "brainstorm.md"), "notes\n");

    const to = { category: "work", type: "ticketed", id: "PROJ-999-research-foo" };
    moveEntry(root, created.pointer, to, {
      now: TODAY,
      layout: "dir",
      extras: { ticket_id: "PROJ-999" },
    });

    // source dir gone
    assert.equal(existsSync(srcDir), false);
    // attachment carried over to target dir
    assert.ok(existsSync(join(entryDirPath(root, to), "brainstorm.md")));
    const target = readEntry(root, to);
    assert.equal(target.data.ticket_id, "PROJ-999");
    assert.equal(target.data.promoted_from, undefined);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -A3 "graduates a file-layout"`
Expected: FAIL — source still exists / `promoted_from` still set.

- [ ] **Step 3: Rewrite `moveEntry`**

Replace the whole of `lib/promote/move.js` with:

```js
// lib/promote/move.js
import { cpSync, copyFileSync, mkdirSync, unlinkSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { readEntry } from "../entries/read.js";
import { writeFrontmatter } from "../frontmatter.js";
import { entryFilePath, entryIndexPath, entryDirPath, locateEntry } from "../entries/path.js";

/**
 * @typedef {import("../entries/path.js").EntryPointer} EntryPointer
 * @typedef {import("../entries/path.js").Layout} Layout
 */

/**
 * Graduate an entry to a new (category, type, id): copy its content (and, for
 * dir-layout sources, all sibling attachments) to the target, then DELETE the
 * source. No audit links are written — the slug, preserved across the move,
 * is the identity (see orchestrate.js for the slug-preservation invariant).
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
    updated: opts.now,
    ...targetExtras,
  };
  // Audit links are retired; never carry them onto the target.
  delete targetData.promoted_to;
  delete targetData.promoted_from;

  const targetPath = opts.layout === "file" ? entryFilePath(root, to) : entryIndexPath(root, to);

  if (sourceLocated.layout === "dir" && opts.layout === "dir") {
    cpSync(entryDirPath(root, from), entryDirPath(root, to), { recursive: true });
    writeFrontmatter(targetPath, targetData, source.body);
  } else if (sourceLocated.layout === "file" && opts.layout === "file") {
    mkdirSync(dirname(targetPath), { recursive: true });
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

  // Graduate: delete the source now that its content lives at the target.
  if (sourceLocated.layout === "dir") {
    rmSync(entryDirPath(root, from), { recursive: true, force: true });
  } else {
    unlinkSync(sourceLocated.path);
  }
}

function pointerKey(ptr) {
  return `${ptr.category}/${ptr.type}/${ptr.id}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | grep -E "moveEntry|fail"`
Expected: all three `moveEntry` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/promote/move.js test/promote/move.test.js
git commit -m "Make promote graduate the source: copy then delete, drop audit links"
```

---

## Task 4: Enforce slug-preservation in `promote()`

**Files:**
- Modify: `lib/promote/orchestrate.js`
- Test: `test/promote/orchestrate.test.js`

- [ ] **Step 1: Write the failing test**

Append to `test/promote/orchestrate.test.js` (match the imports already at the top of that file; add `slugOf` if needed):

```js
test("promote rejects a target whose slug differs from the source slug", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "spark" },
      layout: "file",
      extras: {},
      body: "x",
      now: "2026-05-29",
    });
    assert.throws(
      () =>
        promote(
          root,
          { category: "personal", type: "idea", id: "spark" },
          { category: "personal", type: "unticketed", id: "renamed-spark" },
          { now: "2026-05-29", targetLayout: "file" },
        ),
      /must preserve the slug/,
    );
  });
});

test("promote accepts a ticketed target named <TICKET>-<slug>", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "spark" },
      layout: "file",
      extras: {},
      body: "x",
      now: "2026-05-29",
    });
    const res = promote(
      root,
      { category: "personal", type: "idea", id: "spark" },
      { category: "work", type: "ticketed", id: "EGA-1-spark" },
      { now: "2026-05-29", targetLayout: "dir", extras: { ticket_id: "EGA-1" } },
    );
    assert.equal(res.target.pointer.id, "EGA-1-spark");
  });
});
```

> Note: existing orchestrate tests that promote to a *renamed* slug (if any) must be updated to keep the slug. Adjust their target ids so `slugOf(to) === slugOf(from)`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -A2 "preserve the slug"`
Expected: FAIL — no error thrown for the renamed target.

- [ ] **Step 3: Add the invariant**

In `lib/promote/orchestrate.js`, update the import and add the check at the top of `promote()` (after the `sourceLocated` check):

```js
import { locateEntry, slugOf } from "../entries/path.js";
```

```js
  if (slugOf(from) !== slugOf(to)) {
    throw new Error(
      `promote must preserve the slug: '${slugOf(from)}' (source) != '${slugOf(to)}' (target)`,
    );
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | grep -E "preserve the slug|<TICKET>|fail"`
Expected: both new tests PASS; existing orchestrate tests PASS (after slug fixups).

- [ ] **Step 5: Commit**

```bash
git add lib/promote/orchestrate.js test/promote/orchestrate.test.js
git commit -m "Enforce slug-preservation invariant in promote()"
```

---

## Task 5: Drop the `promoted_to` bucket from completion reports

**Files:**
- Modify: `lib/reports/completion.js`
- Test: `test/reports/completion.test.js`

- [ ] **Step 1: Update the test**

In `test/reports/completion.test.js`, find the test asserting a "Promoted from idea" section (search for `Promoted from idea`). Replace it with a test that confirms the bucket is gone and graduated work shows up as its real entry:

```js
test("buildCompletion has no 'Promoted from idea' bucket; graduated work shows as its entry", async () => {
  const entries = [
    {
      pointer: { category: "personal", type: "unticketed", id: "spark" },
      data: { category: "personal", type: "unticketed", status: "done", updated: "2026-05-10" },
    },
  ];
  const body = buildCompletion(entries, { from: "2026-05-01", to: "2026-05-31" });
  assert.doesNotMatch(body, /Promoted from idea/);
  assert.match(body, /\*\*spark\*\* — done 2026-05-10/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep -A2 "Promoted from idea bucket"`
Expected: FAIL — the old code still emits/handles `promoted_to`.

- [ ] **Step 3: Remove the audit-link handling**

In `lib/reports/completion.js`:

1. On the line building `ofType`, drop the `promoted_to` guard:

```js
      const ofType = ofCategory.filter((e) => e.data.type === type);
```

2. Delete the entire "Promoted ideas" block:

```js
    // Promoted ideas
    const promoted = ofCategory.filter((e) => e.data.type === "idea" && e.data.promoted_to);
    if (promoted.length > 0) {
      lines.push(`### Promoted from idea (${promoted.length})`);
      for (const e of promoted) {
        lines.push(`- \`${e.pointer.id}\` → \`${e.data.promoted_to}\` on ${e.data.updated}`);
      }
      lines.push("");
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | grep -E "completion|fail"`
Expected: completion tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reports/completion.js test/reports/completion.test.js
git commit -m "Remove promoted_to-driven bucket from completion reports"
```

---

## Task 6: Rewrite the prediction status-table resolver

**Files:**
- Modify: `lib/reports/prediction-status.js`
- Test: `test/reports/prediction-status.test.js`

- [ ] **Step 1: Rewrite the resolver tests**

In `test/reports/prediction-status.test.js`, replace the five `resolveStatus: ...` tests with:

```js
test("resolveStatus: a live idea returns its own status", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "idea", id: "foo" },
      layout: "file",
      extras: {},
      body: "",
      now: NOW,
    });
    const entries = listEntries(root, {});
    assert.equal(resolveStatus(entries, "foo"), "todo");
  });
});

test("resolveStatus: graduated to unticketed (same slug) returns the unticketed status", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "personal", type: "unticketed", id: "foo" },
      layout: "file",
      extras: {},
      body: "",
      now: NOW,
    });
    updateEntryFrontmatter(
      root,
      { category: "personal", type: "unticketed", id: "foo" },
      { status: "done" },
    );
    const entries = listEntries(root, {});
    assert.equal(resolveStatus(entries, "foo"), "done");
  });
});

test("resolveStatus: graduated to ticketed <TICKET>-<slug> is located by slug", async () => {
  await withTmpDir(async (root) => {
    createEntry(root, {
      pointer: { category: "work", type: "ticketed", id: "EGA-1-foo" },
      layout: "dir",
      extras: { ticket_id: "EGA-1" },
      body: "",
      now: NOW,
    });
    updateEntryFrontmatter(
      root,
      { category: "work", type: "ticketed", id: "EGA-1-foo" },
      { status: "in-progress" },
    );
    const entries = listEntries(root, {});
    assert.equal(resolveStatus(entries, "foo"), "in-progress");
  });
});

test("resolveStatus: slug found nowhere returns removed", async () => {
  await withTmpDir(async (root) => {
    const entries = listEntries(root, {});
    assert.equal(resolveStatus(entries, "ghost"), "removed");
  });
});

test("resolveStatus: exact slug match, not suffix substring", async () => {
  await withTmpDir(async (root) => {
    // an unrelated slug that *ends with* the queried slug must not match
    createEntry(root, {
      pointer: { category: "personal", type: "unticketed", id: "add-prediction-table" },
      layout: "file",
      extras: {},
      body: "",
      now: NOW,
    });
    const entries = listEntries(root, {});
    assert.equal(resolveStatus(entries, "prediction-table"), "removed");
  });
});
```

Also update the `freshenStatusTable` / `refreshReportFile` tests: their setup creates a `type: idea` entry then sets status — those keep working (a live idea resolves to its own status). The one that set `status: done` on the idea and expected `done` still holds (idea found → its status `done`). No change needed there beyond confirming they pass.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | grep -A2 "located by slug"`
Expected: FAIL — current resolver keys off `promoted_to` and returns `"gone"`.

- [ ] **Step 3: Rewrite `resolveStatus`**

In `lib/reports/prediction-status.js`, update the import line:

```js
import { listEntries } from "../entries/list.js";
import { slugOf } from "../entries/path.js";
```

Replace the whole `resolveStatus` function with:

```js
/**
 * Resolve the status cell for an idea slug by locating the entry that currently
 * carries that slug. A live idea reports its own status; once graduated, the
 * unticketed/ticketed entry (same slug, recovered via slugOf) reports its real
 * current status; if the slug exists nowhere it was deliberately removed.
 *
 * @param {ReturnType<typeof listEntries>} entries
 * @param {string} slug
 * @returns {"todo" | "in-progress" | "done" | "removed" | string}
 */
export function resolveStatus(entries, slug) {
  const idea = entries.find((e) => e.pointer.type === "idea" && slugOf(e.pointer) === slug);
  if (idea) return String(idea.data.status ?? "todo");
  const graduated = entries.find((e) => e.pointer.type !== "idea" && slugOf(e.pointer) === slug);
  if (graduated) return String(graduated.data.status ?? "todo");
  return "removed";
}
```

> `freshenStatusTable` already calls `resolveStatus(entries, r.id)` where `r.id` is the row's slug — no change needed there.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | grep -E "resolveStatus|freshenStatusTable|refreshReportFile|fail"`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/reports/prediction-status.js test/reports/prediction-status.test.js
git commit -m "Resolve prediction status by slug-locate + real status, with removed state"
```

---

## Task 7: Rewrite the promote skill

**Files:**
- Modify: `skills/promote/SKILL.md`

- [ ] **Step 1: Update the frontmatter description**

Replace the `description:` line with:

```
description: Promote (graduate) an archievement entry — idea → ticketed/unticketed, or unticketed → ticketed, possibly across categories. Preserves the slug, deletes the source, handles file → dir expansion.
```

- [ ] **Step 2: Rewrite Step 3 (target id construction)**

Replace the "Target id or slug" bullet under Step 3 with:

```
   - Target id: **the slug is preserved**. For `ticketed`, ask for the ticket ID and build the id as `<TICKET>-<source-slug>` (e.g. source `voice-refactor` + ticket `EGA-5971` → `EGA-5971-voice-refactor`). For every other type, the target id **equals the source slug** — do not rename. `promote()` will reject a target whose slug differs.
```

- [ ] **Step 3: Rewrite Step 4 (plan text)**

Replace the Step 4 paragraph with:

```
4. **Show a plan.** Print: "Promoting (graduating) `<source>` → `<target>`. The source will be **deleted**; its content (and any dir-layout attachments) moves to the target, which keeps the same slug." AskUserQuestion `Proceed / Cancel`.
```

- [ ] **Step 4: Rewrite Step 6 + Invariants**

Replace Step 6 with:

```
6. **Report.** Tell the user the new entry's path and that the source was graduated (deleted) — its content now lives at the target.
```

Replace the Invariants block with:

```
## Invariants

- Never overwrite an existing target — orchestrate.js refuses; surface the error and ask for a different id.
- **promote preserves the slug.** `slugOf(target) === slugOf(source)`; ticketed targets are named `<TICKET>-<slug>`. orchestrate.js enforces this.
- **promote graduates the source: it is deleted, not preserved.** Content (and dir attachments) is copied to the target first, so nothing is lost. No `promoted_from`/`promoted_to` links are written.
- `extras` must include `ticket_id` when target type is `ticketed`; ask if missing.
```

- [ ] **Step 5: Verify skills sanity test still passes**

Run: `npm test 2>&1 | grep -E "skills|fail"`
Expected: `test/skills.test.js` PASSES (valid frontmatter on every skill).

- [ ] **Step 6: Commit**

```bash
git add skills/promote/SKILL.md
git commit -m "Rewrite promote skill for graduate semantics and slug preservation"
```

---

## Task 8: Update the report skill's prediction status wording

**Files:**
- Modify: `skills/report/SKILL.md`

- [ ] **Step 1: Update the Step 5d/5e status semantics**

In `skills/report/SKILL.md`, in the `prediction` flow, replace the sentence describing what the `Status` cell resolves to with:

```
      The `Status` cell MUST be the literal `(pending)` placeholder — step 5e resolves it. Resolution locates the entry currently carrying each row's slug (across `idea`/`unticketed`/`ticketed`, via `slugOf`) and writes that entry's real status (`todo` / `in-progress` / `done`); a slug found nowhere resolves to `removed`.
```

- [ ] **Step 2: Verify skills sanity test passes**

Run: `npm test 2>&1 | grep -E "skills|fail"`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add skills/report/SKILL.md
git commit -m "Document slug-based prediction status resolution in report skill"
```

---

## Task 9: Update spec + CLAUDE.md

**Files:**
- Modify: `docs/superpowers/specs/2026-05-23-archievement-plugin-design.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Spec — frontmatter example (lines ~159-160)**

Remove the `promoted_to:` and `promoted_from:` example lines from the frontmatter sample. Add a one-line note: `# (no audit-link fields: promote graduates the source and preserves the slug)`.

- [ ] **Step 2: Spec — promote flow (lines ~247-256)**

Replace steps describing "Write reciprocal links" / "original is never deleted (audit trail)" with:

```
4. The slug is preserved across the move (`slugOf(target) === slugOf(source)`); ticketed targets are named `<TICKET>-<slug>`.
5. The source's content (and, for dir-layout sources, all sibling attachments) is copied to the target.
6. The source is then **deleted (graduated)** — no audit-link fields are written. The slug, recoverable from every filename, is the identity that lets reports trace an idea to its graduated entry.
```

- [ ] **Step 3: Spec — idea is always file-layout**

In the entry-model / layout section (around lines 74-93, 137, 295), add an explicit rule:

```
`idea` entries are **always file-layout**. A single-file seed; the moment it needs brainstorm/plan/attachments it has graduated (via promote) into an unticketed/ticketed entry, which may be dir-layout. `createEntry` rejects a dir-layout idea.
```

- [ ] **Step 4: Spec — walkthrough (lines ~369-394)**

Update the day-by-day walkthrough that mentions "old idea gets promoted_to, new entry gets promoted_from" / "audit trail chains" to describe graduation (source deleted, slug preserved).

- [ ] **Step 5: CLAUDE.md — §4 description**

In the Repository layout `promote/` line and the §4 Execution-status row, change "cross-bucket move with `promoted_from`/`promoted_to` audit links (source preserved)" to "graduate: cross-bucket move that preserves the slug and **deletes the source** (content copied first); no audit links". Add to Conventions: "**idea is always file-layout** — promote graduates it into unticketed/ticketed for any dir-layout work."

- [ ] **Step 6: Verify nothing references retired fields**

Run: `grep -rn "promoted_from\|promoted_to" lib skills docs/superpowers/specs CLAUDE.md`
Expected: no matches in `lib/`, `skills/`, `CLAUDE.md`, or the design spec. (The historical implementation plan `2026-05-23-...` may still mention them — leave it as a record.)

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs/2026-05-23-archievement-plugin-design.md CLAUDE.md
git commit -m "Update spec and CLAUDE.md for graduate-on-promote + slug identity"
```

---

## Task 10: (Data migration — run against the ARCHIVE, not a source PR)

> Run only after Tasks 1–9 are merged and the plugin is reloaded. Operates on the
> archievement archive returned by `resolveArchievementRoot()`
> (`/Users/irene.yu/Documents/workspaces/IreneXY/archievement`), **not** this source repo.
> Confirm the path before running.

- [ ] **Step 1: Rename the one legacy ticketed entry to `<TICKET>-<slug>`**

```bash
ARCH="$(node -e "import('<plugin>/lib/config/plugin.js').then(({resolveArchievementRoot})=>process.stdout.write(resolveArchievementRoot({pluginConfigPath:'<data>/config.yml'})))")"
mv "$ARCH/work/ticketed/EGA-5971" "$ARCH/work/ticketed/EGA-5971-voicechatservicestate-sealed-class-refactor"
```

`ticket_id: EGA-5971` in its frontmatter stays as-is.

- [ ] **Step 2: Convert the dir-layout idea `static-browse-app` to a single file**

```bash
mv "$ARCH/personal/idea/archievement-followup-static-browse-app/index.md" \
   "$ARCH/personal/idea/archievement-followup-static-browse-app.md"
rmdir "$ARCH/personal/idea/archievement-followup-static-browse-app"
```

Then edit `archievement-followup-static-browse-app.md`: set `layout: file` in frontmatter and delete the trailing "## Followup attachments (when work starts) … This is dir-layout so siblings can land here" paragraph (now obsolete).

- [ ] **Step 3: Verify**

```bash
node -e "import('<plugin>/lib/entries/list.js').then(({listEntries})=>{const es=listEntries('$ARCH',{});const bad=es.filter(e=>e.pointer.type==='idea'&&e.layout==='dir');console.log('dir-layout ideas:',bad.length);console.log('ticketed:',es.filter(e=>e.pointer.type==='ticketed').map(e=>e.pointer.id));})"
```

Expected: `dir-layout ideas: 0`; ticketed id shows `EGA-5971-voicechatservicestate-sealed-class-refactor`.

- [ ] **Step 4: Commit the archive (if the archive is a git repo)**

```bash
cd "$ARCH" && git add -A && git commit -m "Migrate to slug-in-filename: rename EGA-5971, flatten static-browse-app idea"
```

---

## Self-Review

**Spec coverage:**
- idea is always file-layout → Task 2 (enforce) + Task 9 (spec/CLAUDE.md) + record skill already compliant (verified: `skills/record/SKILL.md` line 52 "skip layout for idea — always file").
- promote graduates (delete source) → Task 3.
- slug preserved across promote → Task 4.
- slug encoded in filename / recoverable → Task 1 (`slugOf`) + Task 7 (ticketed `<TICKET>-<slug>`) + Task 10 (migrate).
- retire `promoted_from`/`promoted_to` → Task 3 (move), Task 5 (completion), Task 6 (prediction-status), Task 9 (docs); grep guard in Task 9 Step 6.
- prediction status = filename-locate + real status + `removed` → Task 6.
- migrate existing dir idea + ticketed entry → Task 10.

**Placeholder scan:** every code step shows complete code; doc steps name exact target lines/sections. `<plugin>`/`<data>` in Task 10 are intentional install-path placeholders the operator fills from their environment.

**Type consistency:** `slugOf(ptr)` takes `{ type, id }` and is called as `slugOf(from)`, `slugOf(to)`, `slugOf(e.pointer)` throughout. `resolveStatus(entries, slug)` — second arg renamed from `ideaId` to `slug`; `freshenStatusTable` passes `r.id` (the row's slug) unchanged. `moveEntry`/`promote` signatures are unchanged (behavior-only changes), so no caller updates needed beyond tests.
