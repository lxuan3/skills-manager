import { NextResponse } from "next/server";
import { getToolPaths, detectToolPaths, saveToolPaths, computeToolState } from "@/lib/tool-paths.mjs";

type ToolEntry = { path: string | null; manual: boolean };
type ToolState = "found" | "manual" | "missing" | "undetected";

export async function POST() {
  try {
    const existing = await getToolPaths();
    const detected = detectToolPaths();

    // Merge existing and detected keys so newly-added tools aren't dropped
    const allKeys = new Set([
      ...Object.keys(existing as Record<string, ToolEntry>),
      ...Object.keys(detected as Record<string, string | null>),
    ]);
    const updated: Record<string, ToolEntry> = {};
    for (const key of allKeys) {
      const val = (existing as Record<string, ToolEntry>)[key];
      if (val?.manual) {
        updated[key] = val;
      } else {
        updated[key] = {
          path: (detected as Record<string, string | null>)[key] ?? null,
          manual: false,
        };
      }
    }

    await saveToolPaths(updated);

    const result: Record<string, ToolEntry & { state: ToolState }> = {};
    for (const [key, val] of Object.entries(updated)) {
      result[key] = { ...val, state: computeToolState(val) };
    }
    return NextResponse.json({ tools: result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
