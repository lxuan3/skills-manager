import { NextResponse } from "next/server";
import { getSkillsRepoPath } from "@/lib/config.mjs";
import { openOwnSkill, openOwnDir } from "@/lib/own-skills.mjs";

export async function POST(req: Request) {
  try {
    const repoPath = getSkillsRepoPath();
    const { name } = (await req.json()) as { name?: string };

    if (name) {
      openOwnSkill(repoPath, name);
    } else {
      openOwnDir(repoPath);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
