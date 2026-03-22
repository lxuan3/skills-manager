import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { checkSymlinks } from "./symlinks.mjs";

test("checkSymlinks returns ok=true for correct symlinks", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "symlinks-test-"));
  const agentsSkills = path.join(tmpDir, "agents/skills");
  const target = path.join(tmpDir, "skills/superpowers");
  fs.mkdirSync(agentsSkills, { recursive: true });
  fs.mkdirSync(target, { recursive: true });
  fs.symlinkSync(target, path.join(agentsSkills, "superpowers"));

  try {
    const result = checkSymlinks([
      { link: path.join(agentsSkills, "superpowers"), target },
    ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].ok, true);
    assert.equal(result[0].exists, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("checkSymlinks returns ok=false for missing symlink", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "symlinks-test-"));
  try {
    const result = checkSymlinks([
      { link: path.join(tmpDir, "nonexistent"), target: "/some/target" },
    ]);
    assert.equal(result[0].ok, false);
    assert.equal(result[0].exists, false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("checkSymlinks returns ok=false for wrong target", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "symlinks-test-"));
  const agentsSkills = path.join(tmpDir, "agents/skills");
  fs.mkdirSync(agentsSkills, { recursive: true });
  fs.symlinkSync("/wrong/target", path.join(agentsSkills, "sp"));

  try {
    const result = checkSymlinks([
      { link: path.join(agentsSkills, "sp"), target: "/correct/target" },
    ]);
    assert.equal(result[0].ok, false);
    assert.equal(result[0].exists, true);
    assert.equal(result[0].actualTarget, "/wrong/target");
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});
