import { NextResponse } from "next/server";
import { execFileSync } from "node:child_process";
import { getSkillsRepoPath } from "@/lib/config.mjs";

export async function POST(req: Request) {
  try {
    const repoPath = getSkillsRepoPath();
    const { url, name } = (await req.json()) as { url: string; name: string };

    if (!url || !name) {
      return NextResponse.json({ error: "url and name are required" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        { error: "name must be alphanumeric, hyphens, or underscores" },
        { status: 400 }
      );
    }

    execFileSync("git", ["submodule", "add", url, `third-party/${name}`], {
      cwd: repoPath,
      encoding: "utf8",
    });
    execFileSync("git", ["submodule", "update", "--init", `third-party/${name}`], {
      cwd: repoPath,
      encoding: "utf8",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
