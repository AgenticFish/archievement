// lib/git.js
import { execSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * Normalize a git remote URL to a canonical form.
 *
 * Handles:
 *   git@github.com:foo/bar.git    → github.com/foo/bar
 *   https://github.com/foo/bar.git → github.com/foo/bar
 *
 * @param {string | null | undefined} url
 * @returns {string | null}
 */
export function normalizeGitRemote(url) {
  if (!url || typeof url !== "string") return null;
  let s = url.trim();
  if (!s) return null;

  // strip protocol or SSH prefix
  s = s.replace(/^[a-z]+:\/\//i, "");
  s = s.replace(/^git@/, "");

  // SSH form host:path → host/path
  s = s.replace(/^([^:/]+):/, "$1/");

  // strip trailing slash, then trailing .git
  s = s.replace(/\/+$/, "");
  s = s.replace(/\.git$/, "");

  return s || null;
}

/**
 * Inspect a directory and return a probe that the projects.js matcher can use.
 *
 * @param {string} cwd Absolute path to the directory being probed.
 * @returns {{ remote: string | null, cwd: string }}
 */
export function getProjectProbe(cwd) {
  const absCwd = resolve(cwd);
  let remote = null;
  try {
    const raw = execSync("git remote get-url origin", {
      cwd: absCwd,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    remote = normalizeGitRemote(raw);
  } catch {
    remote = null;
  }
  return { remote, cwd: absCwd };
}
