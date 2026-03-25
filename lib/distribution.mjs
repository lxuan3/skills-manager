// lib/distribution.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { listSubmodules } from "./skills-repo.mjs";
import { getToolPaths } from "./tool-paths.mjs";

/**
 * Resolve tool directory paths from opts or getToolPaths().
 * If all three opts are provided, getToolPaths() is skipped (used in tests).
 */
async function resolveOpts(opts) {
  const toolPaths = await getToolPaths();
  return {
    agentsSkillsDir:
      opts.agentsSkillsDir ??
      toolPaths.claudeCode?.path ??
      path.join(os.homedir(), ".agents/skills"),
    opencodeJsonPath:
      opts.opencodeJsonPath ??
      toolPaths.openCode?.path ??
      path.join(os.homedir(), ".config/opencode/opencode.json"),
    openclawSkillsDir:
      opts.openclawSkillsDir ??
      toolPaths.openClaw?.path ??
      path.join(os.homedir(), ".openclaw/skills"),
    geminiSkillsDir:
      opts.geminiSkillsDir ??
      toolPaths.gemini?.path ??
      null,
  };
}

function symlinkExists(linkPath) {
  try {
    fs.lstatSync(linkPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a directory link. Uses junction on Windows (no admin/Developer Mode
 * required), symlink on other platforms.
 */
function createDirLink(target, linkPath) {
  if (process.platform === "win32") {
    fs.symlinkSync(target, linkPath, "junction");
  } else {
    fs.symlinkSync(target, linkPath);
  }
}

/**
 * Remove a directory link (symlink or junction).
 * On Windows, junctions must be removed with rmdir, not unlink.
 */
function removeDirLink(linkPath) {
  if (process.platform === "win32") {
    try {
      fs.rmdirSync(linkPath);
    } catch {
      fs.unlinkSync(linkPath);
    }
  } else {
    fs.unlinkSync(linkPath);
  }
}

function parseOpencode(opencodeJsonPath) {
  if (!fs.existsSync(opencodeJsonPath)) return [];
  try {
    const config = JSON.parse(fs.readFileSync(opencodeJsonPath, "utf8"));
    return config.plugins ?? [];
  } catch {
    return [];
  }
}

function extractSource(url) {
  if (!url) return "local";
  const m = url.match(/github\.com[/:]([^/]+\/[^/\s.]+?)(?:\.git)?$/);
  if (m) return m[1];
  return path.basename(url.replace(/\.git$/, ""));
}

export async function getDistributionState(repoPath, opts = {}) {
  const { agentsSkillsDir, opencodeJsonPath, openclawSkillsDir, geminiSkillsDir } = await resolveOpts(opts);

  const plugins = parseOpencode(opencodeJsonPath);
  const submodules = listSubmodules(repoPath);

  const namespaces = submodules.map((sub) => {
    const ns = sub.shortName;
    let skills = [];
    if (fs.existsSync(sub.skillsPath)) {
      skills = fs.readdirSync(sub.skillsPath).filter((f) => {
        if (f.startsWith(".")) return false;
        const full = path.join(sub.skillsPath, f);
        return f.endsWith(".md") || fs.statSync(full).isDirectory();
      });
    }
    return {
      name: ns,
      skillCount: sub.skillCount,
      skills,
      source: extractSource(sub.url),
      tools: {
        claudeCode: symlinkExists(path.join(agentsSkillsDir, ns)),
        openCode: plugins.some((p) => p.path === sub.skillsPath),
        openClaw: fs.existsSync(path.join(openclawSkillsDir, ns)),
        gemini: geminiSkillsDir ? symlinkExists(path.join(geminiSkillsDir, ns)) : "na",
      },
    };
  });

  return { namespaces };
}

export async function applyDistributionChanges(repoPath, changes, opts = {}) {
  const { agentsSkillsDir, opencodeJsonPath, openclawSkillsDir, geminiSkillsDir } = await resolveOpts(opts);

  const submodules = listSubmodules(repoPath);

  function getSkillsPath(namespace) {
    const sub = submodules.find((s) => s.shortName === namespace);
    return sub ? sub.skillsPath : null;
  }

  const errors = [];
  // Process disables first, then enables
  const sorted = [...changes].sort((a, b) => (a.enabled ? 1 : 0) - (b.enabled ? 1 : 0));

  for (const { namespace, tool, enabled } of sorted) {
    const skillsPath = getSkillsPath(namespace);
    if (!skillsPath) {
      errors.push({ namespace, tool, error: "namespace not found" });
      continue;
    }

    try {
      if (tool === "claudeCode") {
        const linkPath = path.join(agentsSkillsDir, namespace);
        if (enabled) {
          fs.mkdirSync(agentsSkillsDir, { recursive: true });
          createDirLink(skillsPath, linkPath);
        } else {
          removeDirLink(linkPath);
        }
      } else if (tool === "openCode") {
        let config = { plugins: [] };
        if (fs.existsSync(opencodeJsonPath)) {
          config = JSON.parse(fs.readFileSync(opencodeJsonPath, "utf8"));
          config.plugins = config.plugins ?? [];
        }
        if (enabled) {
          config.plugins.push({ type: "local", path: skillsPath });
        } else {
          config.plugins = config.plugins.filter((p) => p.path !== skillsPath);
        }
        fs.mkdirSync(path.dirname(opencodeJsonPath), { recursive: true });
        fs.writeFileSync(opencodeJsonPath, JSON.stringify(config, null, 2));
      } else if (tool === "openClaw") {
        const targetDir = path.join(openclawSkillsDir, namespace);
        if (enabled) {
          fs.mkdirSync(openclawSkillsDir, { recursive: true });
          execFileSync("rsync", ["-a", skillsPath + "/", targetDir + "/"]);
        } else {
          fs.rmSync(targetDir, { recursive: true, force: true });
        }
      } else if (tool === "gemini") {
        if (!geminiSkillsDir) {
          errors.push({ namespace, tool, error: "Gemini skills directory not configured" });
          continue;
        }
        const linkPath = path.join(geminiSkillsDir, namespace);
        if (enabled) {
          fs.mkdirSync(geminiSkillsDir, { recursive: true });
          createDirLink(skillsPath, linkPath);
        } else {
          removeDirLink(linkPath);
        }
      }
    } catch (e) {
      errors.push({ namespace, tool, error: String(e) });
    }
  }

  return { errors };
}
