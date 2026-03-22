import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { listSubmodules, listOwnSkills } from "./skills-repo.mjs";

function makeTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-repo-test-"));
  // Create .gitmodules
  fs.writeFileSync(
    path.join(dir, ".gitmodules"),
    `[submodule "third-party/superpowers"]\n\tpath = third-party/superpowers\n\turl = https://github.com/obra/superpowers.git\n` +
    `[submodule "third-party/obsidian"]\n\tpath = third-party/obsidian\n\turl = https://github.com/kepano/obsidian-skills.git\n`
  );
  // Create submodule skills directories
  fs.mkdirSync(path.join(dir, "third-party/superpowers/skills/brainstorming"), { recursive: true });
  fs.mkdirSync(path.join(dir, "third-party/superpowers/skills/tdd"), { recursive: true });
  fs.mkdirSync(path.join(dir, "third-party/obsidian/skills/obsidian-cli"), { recursive: true });
  // Create own/ with one skill
  fs.mkdirSync(path.join(dir, "own/my-skill"), { recursive: true });
  fs.writeFileSync(path.join(dir, "own/.gitkeep"), "");
  return dir;
}

test("listSubmodules returns submodule names and urls", () => {
  const dir = makeTempRepo();
  try {
    const result = listSubmodules(dir);
    assert.equal(result.length, 2);
    assert.equal(result[0].name, "third-party/superpowers");
    assert.equal(result[0].url, "https://github.com/obra/superpowers.git");
    assert.equal(result[0].shortName, "superpowers");
    assert.equal(result[0].skillCount, 2);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test("listSubmodules returns 0 skillCount when skills/ dir missing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-empty-"));
  try {
    fs.writeFileSync(
      path.join(dir, ".gitmodules"),
      `[submodule "third-party/cloudflare"]\n\tpath = third-party/cloudflare\n\turl = https://github.com/cloudflare/skills.git\n`
    );
    const result = listSubmodules(dir);
    assert.equal(result[0].skillCount, 0);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test("listOwnSkills returns skill directory names, excludes .gitkeep", () => {
  const dir = makeTempRepo();
  try {
    const result = listOwnSkills(dir);
    assert.deepEqual(result, ["my-skill"]);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test("listOwnSkills returns empty array when own/ has no skills", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-noown-"));
  try {
    fs.mkdirSync(path.join(dir, "own"));
    fs.writeFileSync(path.join(dir, "own/.gitkeep"), "");
    const result = listOwnSkills(dir);
    assert.deepEqual(result, []);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
