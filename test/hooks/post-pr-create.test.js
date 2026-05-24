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
