// lib/hooks/session-start.js
import { listEntries } from "../entries/list.js";
import { getProjectProbe as realProbe } from "../git.js";
import { loadConfig, matchProject } from "../config/plugin.js";

/**
 * @typedef {{
 *   cwd: string,
 *   now: string,
 *   pluginConfigPath?: string,
 *   legacyRcPath?: string,
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
  const config = loadConfig({
    pluginConfigPath: input.pluginConfigPath,
    legacyRcPath: input.legacyRcPath,
  });
  const root = config.archievement_root;
  if (!root) {
    return { additionalContext: "" };
  }

  const probe = (input.getProjectProbe ?? realProbe)(input.cwd);
  const result = matchProject(config, probe);

  if (result.kind === "ignored") {
    return { additionalContext: "" };
  }

  if (result.kind === "unknown") {
    return {
      additionalContext: wrap(
        [
          "unregistered project — cwd is not in archievement's projects list.",
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
      : active.map((e) => `  - ${e.pointer.type}/${e.pointer.id} (${e.data.status})`)),
  ].filter((l) => l !== null);
  return { additionalContext: wrap(lines.join("\n")) };
}

function wrap(content) {
  return `<archievement-context>\n${content}\n</archievement-context>`;
}
