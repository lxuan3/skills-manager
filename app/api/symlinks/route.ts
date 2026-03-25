import { NextResponse } from "next/server";
import path from "node:path";
import os from "node:os";
import { getSkillsRepoPath } from "@/lib/config.mjs";
import { getToolPaths } from "@/lib/tool-paths.mjs";
import { listSubmodules } from "@/lib/skills-repo.mjs";
import { checkSymlinks } from "@/lib/symlinks.mjs";

export async function GET() {
  try {
    const repoPath = getSkillsRepoPath();
    const toolPaths = await getToolPaths();
    const agentsSkills =
      toolPaths.claudeCode?.path ?? path.join(os.homedir(), ".agents/skills");

    const submodules = listSubmodules(repoPath);
    const expected = submodules.map((sub) => ({
      name: sub.shortName,
      link: path.join(agentsSkills, sub.shortName),
      target: sub.skillsPath,
    }));

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
