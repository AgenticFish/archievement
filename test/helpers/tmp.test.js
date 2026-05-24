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
