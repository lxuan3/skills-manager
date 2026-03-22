import { NextResponse } from "next/server";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { getSkillsRepoPath } from "@/lib/config";

export async function POST() {
  try {
    const repoPath = getSkillsRepoPath();
    const syncScript = path.join(repoPath, "sync.sh");
    const output = execFileSync("bash", [syncScript], {
      cwd: repoPath,
      encoding: "utf8",
      env: { ...process.env },
    });
    return NextResponse.json({ output });
  } catch (err: unknown) {
    const output = (err as { stdout?: string }).stdout ?? String(err);
    return NextResponse.json({ error: String(err), output }, { status: 500 });
  }
}
