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
      : active.map((e) => `  - ${e.pointer.type}/${e.pointer.id} (${e.data.status})`)),
  ].filter((l) => l !== null);
  return { additionalContext: wrap(lines.join("\n")) };
}

function wrap(content) {
  return `<archievement-context>\n${content}\n</archievement-context>`;
}
