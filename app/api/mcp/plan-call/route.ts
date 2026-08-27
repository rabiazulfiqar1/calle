import { NextRequest, NextResponse } from "next/server";
import { callCalleTool } from "@/lib/mcp/brokerclient";

// Body: { user_input, to_phones?, region?, language?, goal?, plan_id?, scheduled_at? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const args: Record<string, unknown> = { user_input: body.user_input };

    if (body.plan_id) args.plan_id = body.plan_id;
    if (body.to_phones) args.to_phones = body.to_phones;
    if (body.region) args.region = body.region;
    if (body.language) args.language = body.language;
    if (body.goal) args.goal = body.goal;
    if (body.scheduled_at) args.scheduled_at = body.scheduled_at;

    const result = await callCalleTool("plan_call", args);
    return NextResponse.json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}