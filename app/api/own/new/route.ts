import { NextResponse } from "next/server";
import { getSkillsRepoPath } from "@/lib/config.mjs";
import { createOwnSkill } from "@/lib/own-skills.mjs";

export async function POST(req: Request) {
  try {
    const repoPath = getSkillsRepoPath();
    const { name } = (await req.json()) as { name: string };

    if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        { error: "name must be alphanumeric, hyphens, or underscores" },
        { status: 400 }
      );
    }

    const result = createOwnSkill(repoPath, name);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    return NextResponse.json({ filePath: result.filePath });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
