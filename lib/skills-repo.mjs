// lib/skills-repo.mjs
import fs from "node:fs";
import path from "node:path";

/**
 * Parse .gitmodules and return submodule entries with skill counts.
 * Returns array of { name, shortName, url, skillCount, skillsPath }
 */
export function listSubmodules(repoPath) {
  const gitmodulesPath = path.join(repoPath, ".gitmodules");
  if (!fs.existsSync(gitmodulesPath)) return [];

  const content = fs.readFileSync(gitmodulesPath, "utf8");
  const blocks = content.split(/\[submodule /g).slice(1);
  const result = [];

  for (const block of blocks) {
    const nameMatch = block.match(/^"([^"]+)"/);
    const pathMatch = block.match(/path\s*=\s*(.+)/);
    const urlMatch = block.match(/url\s*=\s*(.+)/);
    if (!nameMatch || !pathMatch || !urlMatch) continue;

    const name = nameMatch[1].trim();
    const subPath = pathMatch[1].trim();
    const url = urlMatch[1].trim();
    const shortName = name.split("/").pop() ?? name;

    const skillsPath = path.join(repoPath, subPath, "skills");
    let skillCount = 0;
    if (fs.existsSync(skillsPath)) {
      skillCount = fs
        .readdirSync(skillsPath)
        .filter((f) => fs.statSync(path.join(skillsPath, f)).isDirectory()).length;
    }

    result.push({ name, shortName, url, skillCount, skillsPath });
  }

  return result;
}

/**
 * List user-authored skills in own/
 * Returns array of skill directory names (excludes .gitkeep and dotfiles)
 */
export function listOwnSkills(repoPath) {
  const ownPath = path.join(repoPath, "own");
  if (!fs.existsSync(ownPath)) return [];

  return fs
    .readdirSync(ownPath)
    .filter(
      (f) =>
        !f.startsWith(".") &&
        fs.statSync(path.join(ownPath, f)).isDirectory()
    );
}
