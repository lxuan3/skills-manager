// lib/distribution.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { listSubmodules } from "./skills-repo.mjs";

function defaultOpts() {
  return {
    agentsSkillsDir: path.join(os.homedir(), ".agents/skills"),
    opencodeJsonPath: path.join(os.homedir(), ".config/opencode/opencode.json"),
    openclawSkillsDir: path.join(os.homedir(), ".openclaw/skills"),
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

export function getDistributionState(repoPath, opts = {}) {
  const { agentsSkillsDir, opencodeJsonPath, openclawSkillsDir } = {
    ...defaultOpts(),
    ...opts,
  };

  const plugins = parseOpencode(opencodeJsonPath);
  const submodules = listSubmodules(repoPath);

  const namespaces = submodules.map((sub) => {
    const ns = sub.shortName;
    const openCodeNA = ns === "cloudflare";
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
      openCode: "na",
      openClaw: fs.existsSync(path.join(openclawSkillsDir, "own")),
    },
  });

  return { namespaces };
}
