// test/helpers/tmp.js
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Run an async callback with a fresh temporary directory.
 * The directory is removed afterward, even if the callback throws.
 *
 * @template T
 * @param {(dir: string) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTmpDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "archievement-test-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
