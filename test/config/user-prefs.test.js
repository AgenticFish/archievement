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
