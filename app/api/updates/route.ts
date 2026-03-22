import { NextResponse } from "next/server";
import { getSkillsRepoPath } from "@/lib/config.mjs";
import { listSubmodules } from "@/lib/skills-repo.mjs";
import { fetchSubmodule } from "@/lib/git.mjs";

export async function POST() {
  try {
    const repoPath = getSkillsRepoPath();
    const submodules = listSubmodules(repoPath);
    // fetchSubmodule runs `git fetch` on the submodule, then diffs local vs remote HEAD
    // to return { hasUpdates, newCommits, ... } — that's the shape this endpoint returns.
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
