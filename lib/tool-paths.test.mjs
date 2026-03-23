import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { detectToolPaths, getToolPaths, saveToolPaths, resetToolPath, computeToolState } from "./tool-paths.mjs";

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

test("getToolPaths: runs detection on first call when no config.json exists", async () => {
  const configPath = path.join(tmp(), "config.json");
  const home = tmp();
  const agentsSkills = path.join(home, ".agents/skills");
  fs.mkdirSync(agentsSkills, { recursive: true });

  const tools = await getToolPaths({ configPath, platform: "darwin", home });

  assert.equal(tools.claudeCode.path, agentsSkills);
  assert.equal(tools.claudeCode.manual, false);
  assert.ok(fs.existsSync(configPath), "config.json created on first run");
});

test("getToolPaths: returns stored config without re-detecting when config exists", async () => {
  const configPath = path.join(tmp(), "config.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const stored = {
    tools: {
      claudeCode: { path: "/custom/path", manual: true },
      openCode: { path: "/oc/opencode.json", manual: false },
      openClaw: { path: "/claw/skills", manual: false },
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(stored));

  const tools = await getToolPaths({ configPath });

  assert.equal(tools.claudeCode.path, "/custom/path");
  assert.equal(tools.claudeCode.manual, true);
});

test("getToolPaths: re-detects and overwrites when config.json is corrupt", async () => {
  const configPath = path.join(tmp(), "config.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, "{ invalid json");
  const home = tmp();

  const tools = await getToolPaths({ configPath, platform: "darwin", home });

  assert.ok(tools, "returns result despite corrupt config");
  const rewritten = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assert.ok(rewritten.tools, "config.json rewritten with valid JSON");
});

test("saveToolPaths: writes config and creates parent directory", async () => {
  const configPath = path.join(tmp(), "nested/deep/config.json");
  const tools = {
    claudeCode: { path: "/foo/bar", manual: false },
    openCode: { path: null, manual: false },
    openClaw: { path: "/claw", manual: true },
  };

  await saveToolPaths(tools, { configPath });

  assert.ok(fs.existsSync(configPath));
  const written = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assert.deepEqual(written.tools, tools);
});

test("computeToolState: returns 'manual' when manual is true regardless of path", () => {
  assert.equal(computeToolState({ path: null, manual: true }), "manual");
  assert.equal(computeToolState({ path: "/nonexistent/path", manual: true }), "manual");
});

test("computeToolState: returns 'undetected' when path is null and not manual", () => {
  assert.equal(computeToolState({ path: null, manual: false }), "undetected");
});

test("computeToolState: returns 'missing' when path set but does not exist on disk", () => {
  assert.equal(computeToolState({ path: "/this/does/not/exist", manual: false }), "missing");
});

test("computeToolState: returns 'found' when path exists on disk", () => {
  const home = tmp();
  assert.equal(computeToolState({ path: home, manual: false }), "found");
});

test("resetToolPath: re-detects specified tool, clears manual, leaves others unchanged", async () => {
  const configPath = path.join(tmp(), "config.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const home = tmp();
  const agentsSkills = path.join(home, ".agents/skills");
  fs.mkdirSync(agentsSkills, { recursive: true });

  const initial = {
    tools: {
      claudeCode: { path: "/old/custom", manual: true },
      openCode: { path: "/oc/opencode.json", manual: true },
      openClaw: { path: null, manual: false },
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(initial));

  await resetToolPath("claudeCode", { configPath, platform: "darwin", home });

  const updated = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assert.equal(updated.tools.claudeCode.manual, false, "manual flag cleared");
  assert.equal(updated.tools.claudeCode.path, agentsSkills, "path re-detected");
  assert.equal(updated.tools.openCode.manual, true, "openCode unchanged");
});
