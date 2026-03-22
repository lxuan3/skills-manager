// lib/git.mjs
import { execFileSync } from "node:child_process";
import path from "node:path";

function git(args, opts = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    ...opts,
  });
}

/**
 * Parse `git submodule status` output.
 * Returns array of { name, sha, initialized, commitDate }
 */
export function getSubmoduleStatus(repoPath) {
  // Read .gitmodules to get the full list (including uninitialized)
  let raw = "";
  try {
    raw = git(["submodule", "status", "--recursive"], { cwd: repoPath });
  } catch {
    raw = "";
  }

  // Also get names from .gitmodules in case some are uninitialized
  let modulesRaw = "";
  try {
    modulesRaw = git(
      ["config", "--file", ".gitmodules", "--get-regexp", "submodule\\..*\\.path"],
      { cwd: repoPath }
    );
  } catch {
    modulesRaw = "";
  }

  // Build map of name → { sha, initialized } from status output
  const statusMap = {};
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const initialized = !line.startsWith("-");
    const sha = line.slice(1, 41).trim();
    const rest = line.slice(42);
    const name = rest.split(" ")[0].trim();
    statusMap[name] = { sha, initialized };
  }

  // Build full list from .gitmodules
  const result = [];
  for (const line of modulesRaw.split("\n")) {
    if (!line.trim()) continue;
    const name = line.split(" ")[1].trim();
    const info = statusMap[name] ?? { sha: "", initialized: false };
    let commitDate = "";
    if (info.initialized && info.sha) {
      try {
        commitDate = git(
          ["log", "-1", "--format=%ai", info.sha],
          { cwd: path.join(repoPath, name) }
        ).trim();
      } catch { commitDate = ""; }
    }
    result.push({ name, sha: info.sha, initialized: info.initialized, commitDate });
  }

  return result;
}

/**
 * Get last N commits for a submodule.
 * Returns array of { sha, message, date }
 */
export function getSubmoduleLog(repoPath, submoduleName, n = 10) {
  const subPath = path.join(repoPath, submoduleName);
  try {
    const raw = git(
      ["log", `--max-count=${n}`, "--pretty=format:%H\t%s\t%ai"],
      { cwd: subPath }
    );
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [sha, message, date] = line.split("\t");
        return { sha, message, date };
      });
  } catch {
    return [];
  }
}

/**
 * Fetch a submodule's remote to check for updates.
 * Returns { hasUpdates, remoteSha, localSha, newCommits[] }
 */
export function fetchSubmodule(repoPath, submoduleName) {
  const subPath = path.join(repoPath, submoduleName);

  // Fetch from remote
  try {
    git(["fetch", "--quiet"], { cwd: subPath });
  } catch {
    return { hasUpdates: false, error: "fetch failed", remoteSha: "", localSha: "", newCommits: [] };
  }

  // Get local HEAD
  let localSha;
  try {
    localSha = git(["rev-parse", "HEAD"], { cwd: subPath }).trim();
  } catch {
    return { hasUpdates: false, error: "could not read local HEAD", remoteSha: "", localSha: "", newCommits: [] };
  }

  // Get remote HEAD after fetch.
  // Try refs/remotes/origin/HEAD first (set automatically on clone).
  // If that fails, set it via remote set-head and try again.
  // Fall back to FETCH_HEAD.
  let remoteSha = "";
  try {
    remoteSha = git(["rev-parse", "refs/remotes/origin/HEAD"], { cwd: subPath }).trim();
  } catch {
    // Try to set remote HEAD automatically
    try {
      git(["remote", "set-head", "origin", "-a"], { cwd: subPath });
      remoteSha = git(["rev-parse", "refs/remotes/origin/HEAD"], { cwd: subPath }).trim();
    } catch {
      try {
        remoteSha = git(["rev-parse", "FETCH_HEAD"], { cwd: subPath }).trim();
      } catch {
        return { hasUpdates: false, error: "could not read remote HEAD", remoteSha: "", localSha, newCommits: [] };
      }
    }
  }

  if (localSha === remoteSha) {
    return { hasUpdates: false, remoteSha, localSha, newCommits: [] };
  }

  // Get new commits between localSha and remoteSha
  let newCommits = [];
  try {
    const raw = git(
      ["log", `${localSha}..${remoteSha}`, "--pretty=format:%H\t%s\t%ai"],
      { cwd: subPath }
    );
    newCommits = raw.split("\n").filter(Boolean).map((line) => {
      const [sha, message, date] = line.split("\t");
      return { sha, message, date };
    });
  } catch {
    newCommits = [];
  }

  return { hasUpdates: true, remoteSha, localSha, newCommits };
}

/**
 * Upgrade a submodule to its remote HEAD and stage the change.
 * Does NOT commit — call commitUpgrades() after upgrading all desired submodules
 * so that a single bulk commit is created.
 * Returns { success, error? }
 */
export function upgradeSubmodule(repoPath, submoduleName) {
  try {
    git(
      ["submodule", "update", "--remote", "--", submoduleName],
      { cwd: repoPath }
    );
    git(["add", submoduleName], { cwd: repoPath });
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Commit all staged submodule upgrades in a single bulk commit.
 * Call after upgrading one or more submodules.
 * Returns { success, commitSha, error? }
 */
export function commitUpgrades(repoPath, submoduleNames) {
  try {
    const date = new Date().toISOString().slice(0, 10);
    const short = submoduleNames.map((n) => n.split("/").pop()).join(", ");
    git(
      ["commit", "-m", `chore: update third-party skills (${short}) ${date}`],
      { cwd: repoPath }
    );
    const commitSha = git(["rev-parse", "HEAD"], { cwd: repoPath }).trim();
    return { success: true, commitSha };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
