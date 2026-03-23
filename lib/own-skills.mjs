// lib/own-skills.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Create a new skill file at own/{name}.md with a minimal frontmatter template.
 * Returns { filePath } on success or { error } if the file already exists.
 */
export function createOwnSkill(repoPath, name) {
  const ownPath = path.join(repoPath, "own");
  const filePath = path.join(ownPath, name + ".md");

  if (fs.existsSync(filePath)) {
    return { error: `Skill already exists: ${name}.md` };
  }

  fs.mkdirSync(ownPath, { recursive: true });
  const template = `---\nname: ${name}\ndescription: \n---\n`;
  fs.writeFileSync(filePath, template);
  return { filePath };
}

/**
 * Open a specific own/ skill file in the system default editor.
 * Uses absolute path to avoid process CWD issues.
 */
export function openOwnSkill(repoPath, name) {
  const filePath = path.join(repoPath, "own", name + ".md");
  execFileSync("open", [filePath]);
}

/**
 * Open the own/ directory in Finder.
 */
export function openOwnDir(repoPath) {
  const ownPath = path.join(repoPath, "own");
  execFileSync("open", [ownPath]);
}
