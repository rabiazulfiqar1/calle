import { NextRequest, NextResponse } from "next/server";
import { callCalleTool } from "@/lib/mcp/brokerclient";
import { getUserId } from "@/lib/auth/getUserId";
import { checkPlanRateLimit } from "@/lib/ratelimit";

// Body: { user_input, to_phones?, region?, language?, goal?, plan_id?, scheduled_at? }
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Planning doesn't dial — rate limit only, not quota.
    const limit = await checkPlanRateLimit(userId);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Try again after ${new Date(limit.resetAt).toLocaleTimeString()}.` },
        { status: 429 }
      );
    }

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
  }catch (error: unknown) {
    console.error("plan_call failed:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  } 
}