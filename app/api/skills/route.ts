import { NextResponse } from "next/server";
import { getSkillsRepoPath } from "@/lib/config";
import { listSubmodules, listOwnSkills } from "@/lib/skills-repo";
import { getSubmoduleStatus } from "@/lib/git";

export async function GET() {
  try {
    const repoPath = getSkillsRepoPath();
    const submodules = listSubmodules(repoPath);
    const gitStatus = getSubmoduleStatus(repoPath);
    const statusMap = Object.fromEntries(gitStatus.map((s) => [s.name, s]));
    const submodulesWithStatus = submodules.map((s) => ({
      ...s,
      sha: statusMap[s.name]?.sha ?? "",
      initialized: statusMap[s.name]?.initialized ?? false,
      commitDate: statusMap[s.name]?.commitDate ?? "",
    }));
    const ownSkills = listOwnSkills(repoPath);
    return NextResponse.json({ submodules: submodulesWithStatus, ownSkills, repoPath });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
