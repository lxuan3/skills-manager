import { NextResponse } from "next/server";
import path from "path";
import { getSkillsRepoPath } from "@/lib/config.mjs";
import { listSubmodules } from "@/lib/skills-repo.mjs";
import { removeSubmodule } from "@/lib/git.mjs";
import { applyDistributionChanges } from "@/lib/distribution.mjs";

const TOOLS = ["claudeCode", "openCode", "openClaw"];

export async function DELETE(req: Request) {
  try {
    const repoPath = getSkillsRepoPath();
    const { name } = (await req.json()) as { name: string };

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const submodules = listSubmodules(repoPath);
    const sub = submodules.find((s) => s.shortName === name);
    if (!sub) {
      return NextResponse.json({ error: `Submodule not found: ${name}` }, { status: 404 });
    }

    // Disable all distributions for this namespace before removal
    const disableChanges = TOOLS.map((tool) => ({ namespace: name, tool, enabled: false }));
    await applyDistributionChanges(repoPath, disableChanges);

    // Derive the submodule path (relative to repo root) from skillsPath
    const submodulePath = path.relative(repoPath, path.dirname(sub.skillsPath));
    const result = removeSubmodule(repoPath, submodulePath);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
