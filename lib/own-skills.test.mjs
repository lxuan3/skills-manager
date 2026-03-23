import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createOwnSkill } from "./own-skills.mjs";

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "own-test-"));
}

test("createOwnSkill: creates .md file with frontmatter template", async () => {
  const repoPath = tmp();
  fs.mkdirSync(path.join(repoPath, "own"));

  const result = createOwnSkill(repoPath, "my-skill");

  assert.ok(!result.error, `unexpected error: ${result.error}`);
  const filePath = path.join(repoPath, "own", "my-skill.md");
  assert.ok(fs.existsSync(filePath));
  const content = fs.readFileSync(filePath, "utf8");
  assert.ok(content.includes("name: my-skill"), "frontmatter has name field");
  assert.ok(content.startsWith("---"), "starts with frontmatter delimiter");
});

test("createOwnSkill: creates own/ dir if it does not exist", async () => {
  const repoPath = tmp();

  const result = createOwnSkill(repoPath, "auto-dir-skill");

  assert.ok(!result.error);
  assert.ok(fs.existsSync(path.join(repoPath, "own", "auto-dir-skill.md")));
});

test("createOwnSkill: returns error when file already exists", async () => {
  const repoPath = tmp();
  fs.mkdirSync(path.join(repoPath, "own"));
  fs.writeFileSync(path.join(repoPath, "own", "existing.md"), "existing content");

  const result = createOwnSkill(repoPath, "existing");

  assert.ok(result.error, "should return error for duplicate");
  assert.ok(!result.filePath, "no filePath on error");
  assert.equal(fs.readFileSync(path.join(repoPath, "own", "existing.md"), "utf8"), "existing content");
});
