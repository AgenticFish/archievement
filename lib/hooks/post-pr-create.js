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
