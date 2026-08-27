import { NextRequest, NextResponse } from "next/server";
import { callCalleTool } from "@/lib/mcp/brokerclient";

// Body: { plan_id, confirm_token }
export async function POST(request: NextRequest) {
  try {
    const { plan_id, confirm_token } = await request.json();
    if (!plan_id || !confirm_token) {
      return NextResponse.json({ error: "plan_id and confirm_token are required" }, { status: 400 });
    }

    const result = await callCalleTool("run_call", { plan_id, confirm_token });
    return NextResponse.json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}