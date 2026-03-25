// lib/skills-repo.mjs
import fs from "node:fs";
import path from "node:path";

/**
 * Resolve the skillsPath for a package directory.
 * Prefers <dir>/skills/ if it exists, otherwise uses <dir>/ itself.
 */
function resolveSkillsPath(pkgDir) {
  const withSkillsDir = path.join(pkgDir, "skills");
  return fs.existsSync(withSkillsDir) ? withSkillsDir : pkgDir;
}

/**
 * Count skills in a skillsPath directory.
 * Counts both .md files and subdirectories (namespace-style).
 */
function countSkills(skillsPath) {
  if (!fs.existsSync(skillsPath)) return 0;
  return fs.readdirSync(skillsPath).filter((f) => {
    if (f.startsWith(".")) return false;
    const full = path.join(skillsPath, f);
    return f.endsWith(".md") || fs.statSync(full).isDirectory();
  }).length;
}

/**
 * List all skill packages under third-party/.
 * Reads .gitmodules for proper submodules, then scans third-party/ for any
 * plain directories not already covered.
 * Returns array of { name, shortName, url, skillCount, skillsPath }
 */
export function listSubmodules(repoPath) {
  const result = [];
  const coveredAbsPaths = new Set();

  // 1. Parse .gitmodules
  const gitmodulesPath = path.join(repoPath, ".gitmodules");
  if (fs.existsSync(gitmodulesPath)) {
    const content = fs.readFileSync(gitmodulesPath, "utf8");
    const blocks = content.split(/\[submodule /g).slice(1);
    for (const block of blocks) {
      const nameMatch = block.match(/^"([^"]+)"/);
      const pathMatch = block.match(/path\s*=\s*(.+)/);
      const urlMatch = block.match(/url\s*=\s*(.+)/);
      if (!nameMatch || !pathMatch) continue;
      const name = nameMatch[1].trim();
      const subPath = pathMatch[1].trim();
      const url = urlMatch ? urlMatch[1].trim() : null;
      const shortName = name.split("/").pop() ?? name;
      const absSubPath = path.join(repoPath, subPath);
      coveredAbsPaths.add(absSubPath);
      const skillsPath = resolveSkillsPath(absSubPath);
      result.push({ name, shortName, url, skillCount: countSkills(skillsPath), skillsPath });
    }
  }

  // 2. Scan third-party/ for plain directories not in .gitmodules
  const thirdPartyPath = path.join(repoPath, "third-party");
  if (fs.existsSync(thirdPartyPath)) {
    for (const entry of fs.readdirSync(thirdPartyPath)) {
      if (entry.startsWith(".")) continue;
      const fullPath = path.join(thirdPartyPath, entry);
      if (!fs.statSync(fullPath).isDirectory()) continue;
      if (coveredAbsPaths.has(fullPath)) continue;
      const skillsPath = resolveSkillsPath(fullPath);
      result.push({ name: entry, shortName: entry, url: null, skillCount: countSkills(skillsPath), skillsPath });
    }
  }

  return result;
}
