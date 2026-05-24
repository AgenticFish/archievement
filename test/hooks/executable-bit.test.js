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
