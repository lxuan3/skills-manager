import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  getSubmoduleStatus,
  getSubmoduleLog,
  fetchSubmodule,
  upgradeSubmodule,
  commitUpgrades,
  removeSubmodule,
} from "./git.mjs";

// Helper: git exec that allows file:// transport (needed on macOS with strict git security policy)
function git(args, opts = {}) {
  return execFileSync("git", ["-c", "protocol.file.allow=always", ...args], {
    encoding: "utf8",
    ...opts,
  });
}

// Helper: create a bare "upstream" repo and a local repo with a submodule
function setupTestRepos() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-test-"));
  const upstreamDir = path.join(tmpDir, "upstream");
  const repoDir = path.join(tmpDir, "repo");

  // Create upstream bare repo with one commit
  fs.mkdirSync(upstreamDir);
  git(["init", "--bare"], { cwd: upstreamDir });

  // Clone upstream as "work" repo to add a commit
  const workDir = path.join(tmpDir, "work");
  git(["clone", upstreamDir, workDir]);
  git(["config", "user.email", "test@test.com"], { cwd: workDir });
  git(["config", "user.name", "Test"], { cwd: workDir });
  fs.writeFileSync(path.join(workDir, "README.md"), "hello");
  git(["add", "."], { cwd: workDir });
  git(["commit", "-m", "init"], { cwd: workDir });
  git(["push"], { cwd: workDir });

  // Create main repo with the submodule
  fs.mkdirSync(repoDir);
  git(["init"], { cwd: repoDir });
  git(["config", "user.email", "test@test.com"], { cwd: repoDir });
  git(["config", "user.name", "Test"], { cwd: repoDir });
  // Allow file:// transport locally so production git() calls work in tests
  git(["config", "protocol.file.allow", "always"], { cwd: repoDir });
  git(["submodule", "add", upstreamDir, "sub/test"], { cwd: repoDir });
  // Allow file:// transport in the submodule dir so production git() calls work in tests
  git(["config", "protocol.file.allow", "always"], { cwd: path.join(repoDir, "sub/test") });
  git(["commit", "-m", "add submodule"], { cwd: repoDir });

  return { tmpDir, repoDir, upstreamDir, workDir };
}

test("getSubmoduleStatus returns list with name and sha", () => {
  const { repoDir, tmpDir } = setupTestRepos();
  try {
    const result = getSubmoduleStatus(repoDir);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "sub/test");
    assert.match(result[0].sha, /^[0-9a-f]{40}$/);
    assert.equal(result[0].initialized, true);
    assert.ok(result[0].commitDate); // commitDate is populated for initialized submodules
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("getSubmoduleStatus marks uninitialized submodule", () => {
  const { repoDir, tmpDir, upstreamDir } = setupTestRepos();
  try {
    // Add a second submodule entry to .gitmodules without init
    const upstream2 = path.join(tmpDir, "upstream2");
    fs.mkdirSync(upstream2);
    execFileSync("git", ["init", "--bare"], { cwd: upstream2 });

    const gitmodules = path.join(repoDir, ".gitmodules");
    const existing = fs.readFileSync(gitmodules, "utf8");
    fs.writeFileSync(gitmodules, existing + `\n[submodule "sub/uninit"]\n\tpath = sub/uninit\n\turl = ${upstream2}\n`);

    const result = getSubmoduleStatus(repoDir);
    const uninit = result.find((s) => s.name === "sub/uninit");
    assert.ok(uninit, "should find uninit submodule");
    assert.equal(uninit.initialized, false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("getSubmoduleLog returns commits for initialized submodule", () => {
  const { repoDir, tmpDir } = setupTestRepos();
  try {
    const logs = getSubmoduleLog(repoDir, "sub/test", 5);
    assert.ok(Array.isArray(logs));
    assert.ok(logs.length >= 1);
    assert.ok(logs[0].sha);
    assert.ok(logs[0].message);
    assert.ok(logs[0].date); // date field is present and non-empty
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("fetchSubmodule returns hasUpdates=false when already up to date", () => {
  const { repoDir, tmpDir } = setupTestRepos();
  try {
    const result = fetchSubmodule(repoDir, "sub/test");
    assert.equal(result.hasUpdates, false);
    assert.deepEqual(result.newCommits, []);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("fetchSubmodule detects new commits on upstream", () => {
  const { repoDir, tmpDir, workDir } = setupTestRepos();
  try {
    // Push a new commit to upstream after the submodule was pinned
    fs.writeFileSync(path.join(workDir, "update.md"), "update");
    execFileSync("git", ["add", "."], { cwd: workDir });
    execFileSync("git", ["commit", "-m", "second commit"], { cwd: workDir });
    execFileSync("git", ["push"], { cwd: workDir });

    const result = fetchSubmodule(repoDir, "sub/test");
    assert.equal(result.hasUpdates, true);
    assert.ok(result.newCommits.length >= 1);
    assert.equal(result.newCommits[0].message, "second commit");
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("upgradeSubmodule and commitUpgrades advance submodule pointer", () => {
  const { repoDir, tmpDir, workDir } = setupTestRepos();
  try {
    // Push a new commit to upstream
    fs.writeFileSync(path.join(workDir, "v2.md"), "v2");
    execFileSync("git", ["add", "."], { cwd: workDir });
    execFileSync("git", ["commit", "-m", "v2"], { cwd: workDir });
    execFileSync("git", ["push"], { cwd: workDir });

    // Fetch so the submodule knows about the new commit
    fetchSubmodule(repoDir, "sub/test");

    const statusBefore = getSubmoduleStatus(repoDir);
    const shaBeforeUpgrade = statusBefore[0].sha;

    const upgradeResult = upgradeSubmodule(repoDir, "sub/test");
    assert.equal(upgradeResult.success, true);

    const commitResult = commitUpgrades(repoDir, ["sub/test"]);
    assert.equal(commitResult.success, true);
    assert.match(commitResult.commitSha, /^[0-9a-f]{40}$/);

    // Verify the submodule pointer actually advanced
    const statusAfter = getSubmoduleStatus(repoDir);
    assert.notEqual(statusAfter[0].sha, shaBeforeUpgrade);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("removeSubmodule removes .gitmodules entry", () => {
  const { repoDir, tmpDir } = setupTestRepos();
  try {
    removeSubmodule(repoDir, "sub/test");
    const gitmodules = fs.readFileSync(path.join(repoDir, ".gitmodules"), "utf8");
    assert.equal(gitmodules.trim(), "", "gitmodules should be empty after removing last submodule");
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("removeSubmodule deletes the submodule directory", () => {
  const { repoDir, tmpDir } = setupTestRepos();
  try {
    removeSubmodule(repoDir, "sub/test");
    assert.ok(
      !fs.existsSync(path.join(repoDir, "sub/test")),
      "sub/test directory should be gone"
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("removeSubmodule cleans up .git/modules cache", () => {
  const { repoDir, tmpDir } = setupTestRepos();
  try {
    removeSubmodule(repoDir, "sub/test");
    assert.ok(
      !fs.existsSync(path.join(repoDir, ".git", "modules", "sub/test")),
      ".git/modules/sub/test should be gone"
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("removeSubmodule returns error for nonexistent submodule path", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-nongit-"));
  try {
    const result = removeSubmodule(tmpDir, "sub/nonexistent");
    assert.equal(result.success, false, "should return success=false");
    assert.ok(result.error, "should return an error message");
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});
