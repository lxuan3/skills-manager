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
  if (opts.agentsSkillsDir && opts.opencodeJsonPath && opts.openclawSkillsDir) {
    return {
      agentsSkillsDir: opts.agentsSkillsDir,
      opencodeJsonPath: opts.opencodeJsonPath,
      openclawSkillsDir: opts.openclawSkillsDir,
    };
  }
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
  const m = url.match(/github\.com[/:]([^/]+\/[^/\s.]+?)(?:\.git)?$/);
  if (m) return m[1];
  return path.basename(url.replace(/\.git$/, ""));
}

export async function getDistributionState(repoPath, opts = {}) {
  const { agentsSkillsDir, opencodeJsonPath, openclawSkillsDir } = await resolveOpts(opts);

  const plugins = parseOpencode(opencodeJsonPath);
  const submodules = listSubmodules(repoPath);

  const namespaces = submodules.map((sub) => {
    const ns = sub.shortName;
    const openCodeNA = false;
    return {
      name: ns,
      skillCount: sub.skillCount,
      source: extractSource(sub.url),
      tools: {
        claudeCode: symlinkExists(path.join(agentsSkillsDir, ns)),
        openCode: openCodeNA ? "na" : plugins.some((p) => p.path === sub.skillsPath),
        openClaw: fs.existsSync(path.join(openclawSkillsDir, ns)),
      },
    };
  });

  // own/ namespace always appended
  const ownPath = path.join(repoPath, "own");
  const ownSkillCount = fs.existsSync(ownPath)
    ? fs.readdirSync(ownPath).filter((f) => !f.startsWith(".") && f.endsWith(".md")).length
    : 0;

  namespaces.push({
    name: "own",
    skillCount: ownSkillCount,
    source: "user-authored",
    tools: {
      claudeCode: symlinkExists(path.join(agentsSkillsDir, "own")),
      openCode: plugins.some((p) => p.path === ownPath),
      openClaw: fs.existsSync(path.join(openclawSkillsDir, "own")),
    },
  });

  return { namespaces };
}

export async function applyDistributionChanges(repoPath, changes, opts = {}) {
  const { agentsSkillsDir, opencodeJsonPath, openclawSkillsDir } = await resolveOpts(opts);

  const submodules = listSubmodules(repoPath);
  const ownSkillsPath = path.join(repoPath, "own");

  function getSkillsPath(namespace) {
    if (namespace === "own") return ownSkillsPath;
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
          fs.symlinkSync(skillsPath, linkPath);
        } else {
          fs.unlinkSync(linkPath);
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
      }
    } catch (e) {
      errors.push({ namespace, tool, error: String(e) });
    }
  }

  return { errors };
}
