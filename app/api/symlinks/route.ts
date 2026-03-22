import { NextResponse } from "next/server";
import path from "node:path";
import os from "node:os";
import { getSkillsRepoPath } from "@/lib/config.mjs";
import { checkSymlinks } from "@/lib/symlinks.mjs";

export async function GET() {
  try {
    const repoPath = getSkillsRepoPath();
    const agentsSkills = path.join(os.homedir(), ".agents/skills");
    const expected = [
      { name: "superpowers", link: path.join(agentsSkills, "superpowers"), target: path.join(repoPath, "third-party/superpowers/skills") },
      { name: "obsidian",    link: path.join(agentsSkills, "obsidian"),    target: path.join(repoPath, "third-party/obsidian/skills") },
      { name: "cloudflare",  link: path.join(agentsSkills, "cloudflare"),  target: path.join(repoPath, "third-party/cloudflare/skills") },
    ];
    const results = checkSymlinks(expected.map(({ link, target }) => ({ link, target })));
    const withNames = results.map((r) => {
      const match = expected.find((e) => e.link === r.link);
      return { ...r, name: match?.name ?? r.link };
    });
    return NextResponse.json({ symlinks: withNames });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
