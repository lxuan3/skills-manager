import { NextResponse } from "next/server";
import { getToolPaths, saveToolPaths, computeToolState } from "@/lib/tool-paths.mjs";

type ToolEntry = { path: string | null; manual: boolean };
type ToolState = "found" | "manual" | "missing" | "undetected";

export async function GET() {
  try {
    const tools = await getToolPaths();
    const result: Record<string, ToolEntry & { state: ToolState }> = {};
    for (const [key, val] of Object.entries(tools)) {
      result[key] = { ...(val as ToolEntry), state: computeToolState(val as ToolEntry) };
    }
    return NextResponse.json({ tools: result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tool, path: toolPath } = (await req.json()) as {
      tool: string;
      path: string;
    };
    if (!tool || !toolPath) {
      return NextResponse.json({ error: "tool and path are required" }, { status: 400 });
    }
    const VALID_TOOLS = ["claudeCode", "openCode", "openClaw", "gemini", "codex"] as const;
    if (!VALID_TOOLS.includes(tool as (typeof VALID_TOOLS)[number])) {
      return NextResponse.json({ error: `unknown tool: ${tool}` }, { status: 400 });
    }
    const tools = await getToolPaths();
    (tools as Record<string, ToolEntry>)[tool] = { path: toolPath, manual: true };
    await saveToolPaths(tools);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
