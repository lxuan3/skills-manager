// lib/config.mjs
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

function getConfigPath() {
  const base =
    process.platform === "win32"
      ? (process.env.APPDATA ?? path.join(os.homedir(), "AppData/Roaming"))
      : path.join(os.homedir(), ".config");
  return path.join(base, "skills-manager/config.json");
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(data) {
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

/**
 * Returns the skills repo path, or null if not configured or path doesn't exist.
 * Reads from (in priority order): SKILLS_REPO_PATH env var, config.json repoPath.
 */
export function getSkillsRepoPath() {
  const raw = process.env.SKILLS_REPO_PATH ?? readConfig().repoPath ?? null;
  if (!raw) return null;
  const expanded = raw.startsWith("~/")
    ? path.join(os.homedir(), raw.slice(2))
    : raw;
  return fs.existsSync(expanded) ? expanded : null;
}

/**
 * Returns the raw configured repo path string (not expanded, not existence-checked),
 * or null if nothing is configured.
 */
export function getRawSkillsRepoPath() {
  return process.env.SKILLS_REPO_PATH ?? readConfig().repoPath ?? null;
}

/**
 * Saves the repo path to config.json.
 * @param {string} repoPath — raw path (may contain ~)
 */
export function setSkillsRepoPath(repoPath) {
  const existing = readConfig();
  writeConfig({ ...existing, repoPath });
}
