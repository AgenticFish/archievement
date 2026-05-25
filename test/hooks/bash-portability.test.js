// test/hooks/bash-portability.test.js
//
// Guards against bash 4+ syntax in the hook wrappers. macOS still ships
// bash 3.2.57 as `/bin/bash`, and `#!/usr/bin/env bash` picks that up
// unless the user has installed a newer bash. Hook scripts must run on
// bash 3.2.
//
// History: an earlier version of post-tool-use-gh-pr-create used
// `${INPUT@Q}` to shell-quote the JSON payload before inlining it into a
// Node `-e` string. `@Q` is bash 4.4+. On macOS bash 3.2 every Bash tool
// invocation produced `bad substitution` and the hook silently failed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK_DIR = join(HERE, "..", "..", "hooks");
const HOOKS = ["session-start", "post-tool-use-gh-pr-create"];

test("no hook script uses bash 4+ ${VAR@Q} parameter expansion", () => {
  for (const name of HOOKS) {
    const src = readFileSync(join(HOOK_DIR, name), "utf8");
    assert.ok(
      !/\$\{[A-Za-z_][A-Za-z0-9_]*@Q\}/.test(src),
      `${name}: contains \${VAR@Q} (bash 4.4+ only); use env vars or stdin instead`,
    );
  }
});

test("post-tool-use-gh-pr-create handles input with apostrophes and a PR URL", () => {
  // Apostrophe inside the gh pr create body used to choke the @Q quoting.
  const input = JSON.stringify({
    tool_name: "Bash",
    tool_input: {
      command: 'gh pr create --title "don\'t break" --body "apostrophes shouldn\'t break"',
    },
    tool_response: { output: "https://github.com/AgenticFish/archievement/pull/99\n" },
  });
  const result = spawnSync("bash", [join(HOOK_DIR, "post-tool-use-gh-pr-create")], {
    input,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `script exited ${result.status}; stderr: ${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assert.match(parsed.hookSpecificOutput.additionalContext, /PR #99/);
  assert.match(parsed.hookSpecificOutput.additionalContext, /archievement-nudge/);
});

test("post-tool-use-gh-pr-create exits cleanly for non-gh-pr-create commands", () => {
  const input = JSON.stringify({
    tool_name: "Bash",
    tool_input: { command: "ls -la" },
    tool_response: { output: "some files\n" },
  });
  const result = spawnSync("bash", [join(HOOK_DIR, "post-tool-use-gh-pr-create")], {
    input,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `script exited ${result.status}; stderr: ${result.stderr}`);
  // No PR URL → no output (script exits silently with empty stdout)
  assert.equal(result.stdout.trim(), "");
});

test("session-start exits cleanly with arbitrary stdin payload", () => {
  // Without a configured ~/.archievementrc the wrapper should still finish
  // successfully. We point HOME at an empty tmp dir to skip the live config.
  const input = JSON.stringify({ cwd: "/tmp/anywhere", session_id: "abc" });
  const result = spawnSync("bash", [join(HOOK_DIR, "session-start")], {
    input,
    encoding: "utf8",
    env: { ...process.env, HOME: "/tmp/__archievement_no_home__" },
  });
  assert.equal(result.status, 0, `script exited ${result.status}; stderr: ${result.stderr}`);
});
