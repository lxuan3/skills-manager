import { NextResponse } from "next/server";
import { getSkillsRepoPath } from "@/lib/config.mjs";
import { getDistributionState, applyDistributionChanges } from "@/lib/distribution.mjs";

export async function GET() {
  try {
    const repoPath = getSkillsRepoPath();
    const state = getDistributionState(repoPath);
    return NextResponse.json(state);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const repoPath = getSkillsRepoPath();
    const { changes } = (await req.json()) as {
      changes: { namespace: string; tool: string; enabled: boolean }[];
    };
    if (!Array.isArray(changes)) {
      return NextResponse.json({ error: "changes must be an array" }, { status: 400 });
    }
    const result = applyDistributionChanges(repoPath, changes);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
