// lib/config.mjs
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

export function getSkillsRepoPath() {
  const raw = process.env.SKILLS_REPO_PATH ?? "~/Github/skills";
  const expanded = raw.startsWith("~/")
    ? path.join(os.homedir(), raw.slice(2))
    : raw;
  if (!fs.existsSync(expanded)) {
    throw new Error(`SKILLS_REPO_PATH does not exist: ${expanded}`);
  }
  return expanded;
}
