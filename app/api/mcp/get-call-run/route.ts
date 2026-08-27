import { NextRequest, NextResponse } from "next/server";
import { callCalleTool } from "@/lib/mcp/brokerclient";

// Body: { run_id, cursor?, limit? }
export async function POST(request: NextRequest) {
  try {
    const { run_id, cursor, limit } = await request.json();
    if (!run_id) {
      return NextResponse.json({ error: "run_id is required" }, { status: 400 });
    }

    const args: Record<string, unknown> = { run_id };
    if (cursor) args.cursor = cursor;
    if (limit) args.limit = limit;

    const result = await callCalleTool("get_call_run", args);
    return NextResponse.json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}