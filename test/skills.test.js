// test/skills.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(HERE, "..", "skills");

test("each skills/*/SKILL.md has well-formed frontmatter and a body", () => {
  const entries = readdirSync(SKILLS_DIR).filter((n) =>
    statSync(join(SKILLS_DIR, n)).isDirectory(),
  );
  assert.ok(entries.length > 0, "no skills present");
  for (const skill of entries) {
    const skillFile = join(SKILLS_DIR, skill, "SKILL.md");
    let raw;
    try {
      raw = readFileSync(skillFile, "utf8");
    } catch (err) {
      assert.fail(`${skill}: SKILL.md not readable (${err.message})`);
    }
    const { data, content } = matter(raw);
    assert.ok(data.name, `${skill}: frontmatter missing 'name'`);
    assert.match(data.name, /^[a-z][a-z0-9-]*$/, `${skill}: name must be kebab-case`);
    assert.ok(data.description, `${skill}: frontmatter missing 'description'`);
    assert.ok(data.description.length >= 20, `${skill}: description too short`);
    assert.ok(content.trim().length > 100, `${skill}: body too short`);
  }
});
