// lib/tool-paths.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ── helpers ──────────────────────────────────────────────────────────────────

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function firstExists(...candidates) {
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

// ── per-tool detection ────────────────────────────────────────────────────────

function detectClaudeCode({ platform, home, appdata, userprofile }) {
  // Step 1: read settings.json
  const settingsPath =
    platform === "win32"
      ? path.join(appdata, "Claude/settings.json")
      : path.join(home, ".claude/settings.json");
  const settings = readJson(settingsPath);
  if (settings?.skillsDirectory) {
    return settings.skillsDirectory;
  }
  // Step 2: candidate
  const candidate =
    platform === "win32"
      ? path.join(userprofile, ".agents/skills")
      : path.join(home, ".agents/skills");
  return firstExists(candidate);
}

function detectOpenCode({ platform, home, appdata }) {
  const candidate =
    platform === "win32"
      ? path.join(appdata, "opencode/opencode.json")
      : path.join(home, ".config/opencode/opencode.json");
  return firstExists(candidate);
}

function detectOpenClaw({ platform, home, userprofile }) {
  // Step 1: read config.json
  const configPath =
    platform === "win32"
      ? path.join(userprofile, ".openclaw/config.json")
      : path.join(home, ".openclaw/config.json");
  const config = readJson(configPath);
  if (config?.skillsDir) {
    return config.skillsDir;
  }
  // Step 2: candidate
  const candidate =
    platform === "win32"
      ? path.join(userprofile, ".openclaw/skills")
      : path.join(home, ".openclaw/skills");
  return firstExists(candidate);
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Detect tool paths. All opts are injectable for testing.
 * @param {object} opts
 * @param {string} [opts.platform]    defaults to process.platform
 * @param {string} [opts.home]        defaults to os.homedir()
 * @param {string} [opts.appdata]     defaults to process.env.APPDATA
 * @param {string} [opts.userprofile] defaults to process.env.USERPROFILE
 * @returns {{ claudeCode: string|null, openCode: string|null, openClaw: string|null }}
 */
export function detectToolPaths(opts = {}) {
  const platform = opts.platform ?? process.platform;
  const home = opts.home ?? os.homedir();
  const appdata =
    opts.appdata ?? process.env.APPDATA ?? path.join(home, "AppData/Roaming");
  const userprofile = opts.userprofile ?? process.env.USERPROFILE ?? home;

  const env = { platform, home, appdata, userprofile };
  return {
    claudeCode: detectClaudeCode(env),
    openCode: detectOpenCode(env),
    openClaw: detectOpenClaw(env),
  };
}
