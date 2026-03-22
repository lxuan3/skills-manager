import { NextResponse } from "next/server";
import { getSkillsRepoPath } from "@/lib/config";
import { upgradeSubmodule, commitUpgrades } from "@/lib/git";

export async function POST(req: Request) {
  try {
    const { submodules }: { submodules: string[] } = await req.json();
    if (!Array.isArray(submodules) || submodules.length === 0) {
      return NextResponse.json({ error: "submodules array required" }, { status: 400 });
    }
    const repoPath = getSkillsRepoPath();
    // Upgrade all submodules first (each stages its changes), then commit once.
    const upgradeResults = submodules.map((name) => ({
      name,
      ...upgradeSubmodule(repoPath, name),
    }));
    const succeeded = upgradeResults.filter((r) => r.success).map((r) => r.name);
    let commit = null;
    if (succeeded.length > 0) {
      commit = commitUpgrades(repoPath, succeeded);
    }
    return NextResponse.json({ results: upgradeResults, commit });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
