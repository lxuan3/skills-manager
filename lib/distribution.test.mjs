import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDistributionState } from "./distribution.mjs";

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dist-test-"));
}

function writeGitmodules(repoPath, entries) {
  const content = entries
    .map(
      ({ name, subPath, url }) =>
        `[submodule "${name}"]\n\tpath = ${subPath}\n\turl = ${url}\n`
    )
    .join("\n");
  fs.writeFileSync(path.join(repoPath, ".gitmodules"), content);
}

test("claudeCode: true when symlink exists at agentsSkillsDir/{ns}", async () => {
  const repoPath = tmp();
  const agentsDir = tmp();
  const opencodeJson = path.join(tmp(), "opencode.json");
  const openclawDir = tmp();

  const skillsPath = path.join(repoPath, "third-party/superpowers/skills");
  fs.mkdirSync(skillsPath, { recursive: true });
  writeGitmodules(repoPath, [
    { name: "third-party/superpowers", subPath: "third-party/superpowers", url: "https://github.com/obra/superpowers" },
  ]);
  fs.symlinkSync(skillsPath, path.join(agentsDir, "superpowers"));

  const state = getDistributionState(repoPath, { agentsSkillsDir: agentsDir, opencodeJsonPath: opencodeJson, openclawSkillsDir: openclawDir });
  const ns = state.namespaces.find((n) => n.name === "superpowers");
  assert.ok(ns, "superpowers namespace present");
  assert.equal(ns.tools.claudeCode, true);
  assert.equal(ns.tools.openCode, false);
  assert.equal(ns.tools.openClaw, false);
});

test("claudeCode: false when no symlink", async () => {
  const repoPath = tmp();
  const agentsDir = tmp();
  const skillsPath = path.join(repoPath, "third-party/superpowers/skills");
  fs.mkdirSync(skillsPath, { recursive: true });
  writeGitmodules(repoPath, [
    { name: "third-party/superpowers", subPath: "third-party/superpowers", url: "https://github.com/obra/superpowers" },
  ]);

  const state = getDistributionState(repoPath, {
    agentsSkillsDir: agentsDir,
    opencodeJsonPath: path.join(tmp(), "opencode.json"),
    openclawSkillsDir: tmp(),
  });
  const ns = state.namespaces.find((n) => n.name === "superpowers");
  assert.equal(ns.tools.claudeCode, false);
});

test("claudeCode: true even for broken symlink (lstatSync not existsSync)", async () => {
  const repoPath = tmp();
  const agentsDir = tmp();
  const nonexistentTarget = path.join(tmp(), "does-not-exist");
  const skillsPath = path.join(repoPath, "third-party/superpowers/skills");
  fs.mkdirSync(skillsPath, { recursive: true });
  writeGitmodules(repoPath, [
    { name: "third-party/superpowers", subPath: "third-party/superpowers", url: "https://github.com/obra/superpowers" },
  ]);
  fs.symlinkSync(nonexistentTarget, path.join(agentsDir, "superpowers"));

  const state = getDistributionState(repoPath, {
    agentsSkillsDir: agentsDir,
    opencodeJsonPath: path.join(tmp(), "opencode.json"),
    openclawSkillsDir: tmp(),
  });
  const ns = state.namespaces.find((n) => n.name === "superpowers");
  assert.equal(ns.tools.claudeCode, true, "broken symlink still counts as present");
});

test("openCode: true when plugin entry in opencode.json", async () => {
  const repoPath = tmp();
  const opencodeJsonPath = path.join(tmp(), "opencode.json");
  const skillsPath = path.join(repoPath, "third-party/superpowers/skills");
  fs.mkdirSync(skillsPath, { recursive: true });
  writeGitmodules(repoPath, [
    { name: "third-party/superpowers", subPath: "third-party/superpowers", url: "https://github.com/obra/superpowers" },
  ]);
  fs.writeFileSync(opencodeJsonPath, JSON.stringify({ plugins: [{ type: "local", path: skillsPath }] }));

  const state = getDistributionState(repoPath, {
    agentsSkillsDir: tmp(),
    opencodeJsonPath,
    openclawSkillsDir: tmp(),
  });
  const ns = state.namespaces.find((n) => n.name === "superpowers");
  assert.equal(ns.tools.openCode, true);
});

test("openCode: 'na' for cloudflare and own namespaces", async () => {
  const repoPath = tmp();
  const opencodeJsonPath = path.join(tmp(), "opencode.json");
  const skillsPath = path.join(repoPath, "third-party/cloudflare/skills");
  fs.mkdirSync(skillsPath, { recursive: true });
  fs.mkdirSync(path.join(repoPath, "own"), { recursive: true });
  writeGitmodules(repoPath, [
    { name: "third-party/cloudflare", subPath: "third-party/cloudflare", url: "https://github.com/cloudflare/skills" },
  ]);

  const state = getDistributionState(repoPath, {
    agentsSkillsDir: tmp(),
    opencodeJsonPath,
    openclawSkillsDir: tmp(),
  });
  const cf = state.namespaces.find((n) => n.name === "cloudflare");
  const own = state.namespaces.find((n) => n.name === "own");
  assert.equal(cf.tools.openCode, "na");
  assert.equal(own.tools.openCode, "na");
});

test("openClaw: true when dir exists at openclawSkillsDir/{ns}", async () => {
  const repoPath = tmp();
  const openclawDir = tmp();
  const skillsPath = path.join(repoPath, "third-party/superpowers/skills");
  fs.mkdirSync(skillsPath, { recursive: true });
  fs.mkdirSync(path.join(openclawDir, "superpowers"));
  writeGitmodules(repoPath, [
    { name: "third-party/superpowers", subPath: "third-party/superpowers", url: "https://github.com/obra/superpowers" },
  ]);

  const state = getDistributionState(repoPath, {
    agentsSkillsDir: tmp(),
    opencodeJsonPath: path.join(tmp(), "opencode.json"),
    openclawSkillsDir: openclawDir,
  });
  const ns = state.namespaces.find((n) => n.name === "superpowers");
  assert.equal(ns.tools.openClaw, true);
});

test("own/ namespace always present at end of list", async () => {
  const repoPath = tmp();
  const ownDir = path.join(repoPath, "own");
  fs.mkdirSync(ownDir);
  fs.writeFileSync(path.join(ownDir, "my-skill.md"), "# my skill");

  const state = getDistributionState(repoPath, {
    agentsSkillsDir: tmp(),
    opencodeJsonPath: path.join(tmp(), "opencode.json"),
    openclawSkillsDir: tmp(),
  });
  const own = state.namespaces.find((n) => n.name === "own");
  assert.ok(own, "own namespace present");
  assert.equal(own.skillCount, 1);
  assert.equal(state.namespaces[state.namespaces.length - 1].name, "own");
});
