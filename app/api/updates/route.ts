import { NextResponse } from "next/server";
import { getSkillsRepoPath } from "@/lib/config";
import { listSubmodules } from "@/lib/skills-repo";
import { fetchSubmodule } from "@/lib/git";

export async function POST() {
  try {
    const repoPath = getSkillsRepoPath();
    const submodules = listSubmodules(repoPath);
    const results = submodules.map((s) => ({
      name: s.name,
      shortName: s.shortName,
      ...fetchSubmodule(repoPath, s.name),
    }));
    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
