import { NextRequest, NextResponse } from "next/server";
import { CalleClient } from "@call-e/calle";
import { getUserId } from "@/lib/auth/getUserId";
import { checkCallQuota } from "@/lib/ratelimit";

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // This endpoint places a REAL call — quota, not just rate limit.
    const quota = await checkCallQuota(userId);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Daily call limit reached (${quota.limit}/day). Resets at ${new Date(quota.resetAt).toLocaleString()}.`,
        },
        { status: 429 }
      );
    }

    const { task, recipient } = await request.json();
    if (!task || !recipient?.phone) {
      return NextResponse.json({ error: "task and recipient.phone are required" }, { status: 400 });
    }

    const client = new CalleClient({ apiKey: process.env.CALLE_API_KEY! });

    const call = await client.calls.createAndWait({
      task,
      recipients: [{
        phones: [recipient.phone],
        region: recipient.region || "PK",
        locale: recipient.locale || "en",
      }],
    });

    return NextResponse.json({ result: call, quotaRemaining: quota.remaining });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}