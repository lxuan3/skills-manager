import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectToolPaths } from "./tool-paths.mjs";

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tp-test-"));
}

test("detectToolPaths: returns skillsDirectory from settings.json even when path does not exist", () => {
  const home = tmp();
  // deliberately a non-existent path — configured paths are returned regardless of existence
  const skillsDir = "/some/custom/skills";
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
  fs.writeFileSync(
    path.join(home, ".claude/settings.json"),
    JSON.stringify({ skillsDirectory: skillsDir })
  );

  const result = detectToolPaths({ platform: "darwin", home });
  assert.equal(result.claudeCode, skillsDir);
});

test("detectToolPaths: falls back to ~/.agents/skills when no settings.json", () => {
  const home = tmp();
  const agentsSkills = path.join(home, ".agents/skills");
  fs.mkdirSync(agentsSkills, { recursive: true });

  const result = detectToolPaths({ platform: "darwin", home });
  assert.equal(result.claudeCode, agentsSkills);
});

test("detectToolPaths: returns null for claudeCode when no path found", () => {
  const home = tmp();
  const result = detectToolPaths({ platform: "darwin", home });
  assert.equal(result.claudeCode, null);
});

test("detectToolPaths: uses Windows candidate path when platform is win32", () => {
  const home = tmp();
  const appdata = tmp();
  const userprofile = tmp();
  const winSkills = path.join(userprofile, ".agents/skills");
  fs.mkdirSync(winSkills, { recursive: true });

  const result = detectToolPaths({ platform: "win32", home, appdata, userprofile });
  assert.equal(result.claudeCode, winSkills);
});

test("detectToolPaths: detects OpenCode json from candidate path", () => {
  const home = tmp();
  const opencodeJson = path.join(home, ".config/opencode/opencode.json");
  fs.mkdirSync(path.dirname(opencodeJson), { recursive: true });
  fs.writeFileSync(opencodeJson, "{}");

  const result = detectToolPaths({ platform: "darwin", home });
  assert.equal(result.openCode, opencodeJson);
});

test("detectToolPaths: returns openClaw skillsDir from config even when path does not exist", () => {
  const home = tmp();
  // deliberately a non-existent path — configured paths are returned regardless of existence
  const skillsDir = "/some/custom/openclaw";
  fs.mkdirSync(path.join(home, ".openclaw"), { recursive: true });
  fs.writeFileSync(
    path.join(home, ".openclaw/config.json"),
    JSON.stringify({ skillsDir })
  );

  const result = detectToolPaths({ platform: "darwin", home });
  assert.equal(result.openClaw, skillsDir);
});

test("detectToolPaths: falls back to ~/.openclaw/skills candidate", () => {
  const home = tmp();
  const openclawSkills = path.join(home, ".openclaw/skills");
  fs.mkdirSync(openclawSkills, { recursive: true });

  const result = detectToolPaths({ platform: "darwin", home });
  assert.equal(result.openClaw, openclawSkills);
});

test("detectToolPaths: reads skillsDirectory from %APPDATA%/Claude/settings.json on win32", () => {
  const home = tmp();
  const appdata = tmp();
  const userprofile = tmp();
  // deliberately a non-existent path — configured paths are returned regardless of existence
  const skillsDir = "/some/custom/skills";
  fs.mkdirSync(path.join(appdata, "Claude"), { recursive: true });
  fs.writeFileSync(
    path.join(appdata, "Claude/settings.json"),
    JSON.stringify({ skillsDirectory: skillsDir })
  );

  const result = detectToolPaths({ platform: "win32", home, appdata, userprofile });
  assert.equal(result.claudeCode, skillsDir);
});

test("detectToolPaths: detects OpenCode json on win32 candidate path", () => {
  const home = tmp();
  const appdata = tmp();
  const userprofile = tmp();
  const opencodeJson = path.join(appdata, "opencode/opencode.json");
  fs.mkdirSync(path.dirname(opencodeJson), { recursive: true });
  fs.writeFileSync(opencodeJson, "{}");

  const result = detectToolPaths({ platform: "win32", home, appdata, userprofile });
  assert.equal(result.openCode, opencodeJson);
});

test("detectToolPaths: returns openClaw skillsDir from win32 config even when path does not exist", () => {
  const home = tmp();
  const appdata = tmp();
  const userprofile = tmp();
  // deliberately a non-existent path — configured paths are returned regardless of existence
  const skillsDir = "/some/custom/openclaw";
  fs.mkdirSync(path.join(userprofile, ".openclaw"), { recursive: true });
  fs.writeFileSync(
    path.join(userprofile, ".openclaw/config.json"),
    JSON.stringify({ skillsDir })
  );

  const result = detectToolPaths({ platform: "win32", home, appdata, userprofile });
  assert.equal(result.openClaw, skillsDir);
});

test("detectToolPaths: falls back to candidate when settings.json is corrupt", () => {
  const home = tmp();
  const agentsSkills = path.join(home, ".agents/skills");
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(home, ".claude/settings.json"), "{ invalid json");
  fs.mkdirSync(agentsSkills, { recursive: true });

  const result = detectToolPaths({ platform: "darwin", home });
  assert.equal(result.claudeCode, agentsSkills);
});
