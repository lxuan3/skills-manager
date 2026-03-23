import { NextResponse } from "next/server";
import path from "path";
import os from "os";
import fs from "fs";
import { getSkillsRepoPath, getRawSkillsRepoPath, setSkillsRepoPath } from "@/lib/config.mjs";

export async function GET() {
  const resolved = getSkillsRepoPath();
  const raw = getRawSkillsRepoPath();
  return NextResponse.json({ path: resolved, raw, exists: resolved !== null });
}

export async function POST(req: Request) {
  try {
    const { path: rawPath } = (await req.json()) as { path: string };
    if (!rawPath?.trim()) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }
    const expanded = rawPath.trim().startsWith("~/")
      ? path.join(os.homedir(), rawPath.trim().slice(2))
      : rawPath.trim();
    if (!fs.existsSync(expanded)) {
      return NextResponse.json(
        { error: `Path does not exist: ${expanded}` },
        { status: 400 }
      );
    }
    setSkillsRepoPath(rawPath.trim());
    return NextResponse.json({ ok: true, path: expanded });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
