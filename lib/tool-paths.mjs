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
    // Return the configured path even if it doesn't exist on disk — the API
    // layer surfaces state: "missing" for that case, rather than silently
    // ignoring an explicit user configuration.
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
    // Same rationale as detectClaudeCode: return regardless of existence.
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

// ── config file location ──────────────────────────────────────────────────────

function getDefaultConfigPath() {
  const base =
    process.platform === "win32"
      ? (process.env.APPDATA ?? path.join(os.homedir(), "AppData/Roaming"))
      : path.join(os.homedir(), ".config");
  return path.join(base, "skills-manager/config.json");
}

// ── persistence ───────────────────────────────────────────────────────────────

/**
 * Write tool paths to config file. Creates parent directory if needed.
 * @param {object} tools  — { claudeCode, openCode, openClaw } each { path, manual }
 * @param {object} opts
 * @param {string} [opts.configPath]  defaults to system config dir
 */
export async function saveToolPaths(tools, opts = {}) {
  const configPath = opts.configPath ?? getDefaultConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ tools }, null, 2));
}

/**
 * Get tool paths. Reads config file if it exists; otherwise auto-detects and saves.
 * Corrupt config is treated as missing.
 * @param {object} opts  — passed through to detectToolPaths; also accepts configPath
 */
export async function getToolPaths(opts = {}) {
  const configPath = opts.configPath ?? getDefaultConfigPath();

  if (fs.existsSync(configPath)) {
    const raw = readJson(configPath);
    if (raw?.tools) return raw.tools;
    // corrupt — fall through to re-detect
  }

  const detected = detectToolPaths(opts);
  const tools = {
    claudeCode: { path: detected.claudeCode, manual: false },
    openCode: { path: detected.openCode, manual: false },
    openClaw: { path: detected.openClaw, manual: false },
  };
  await saveToolPaths(tools, { configPath });
  return tools;
}

/**
 * Compute display state for a tool path entry.
 * @param {{ path: string|null, manual: boolean }} entry
 * @returns {"manual"|"undetected"|"missing"|"found"}
 */
export function computeToolState(entry) {
  if (entry.manual) return "manual";
  if (entry.path === null) return "undetected";
  if (!fs.existsSync(entry.path)) return "missing";
  return "found";
}

/**
 * Re-detect a single tool and clear its manual flag.
 * Other tools in the config are unchanged.
 * @param {"claudeCode"|"openCode"|"openClaw"} tool
 * @param {object} opts  — passed through to detectToolPaths; also accepts configPath
 */
export async function resetToolPath(tool, opts = {}) {
  const configPath = opts.configPath ?? getDefaultConfigPath();

  // Load current config (or empty object if missing/corrupt)
  let existing = {};
  if (fs.existsSync(configPath)) {
    existing = readJson(configPath)?.tools ?? {};
  }

  // Re-detect just this tool
  const detected = detectToolPaths(opts);
  const updated = {
    ...existing,
    [tool]: { path: detected[tool], manual: false },
  };

  await saveToolPaths(updated, { configPath });
}
