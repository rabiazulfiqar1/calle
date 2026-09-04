import { NextRequest, NextResponse } from "next/server";
import { CalleClient } from "@call-e/calle";
import { getUserId } from "@/lib/auth/getUserId";
import { checkCallQuota } from "@/lib/ratelimit";
import { createCallRecord } from "@/lib/calle/callStore";

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

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

    const call = await client.calls.create({
      task,
      recipients: [{
        phones: [recipient.phone],
        region: recipient.region || "PK",
        locale: recipient.locale || "en",
      }],
      webhookUrl: `${process.env.APP_BASE_URL}/api/calle/webhook`,
      metadata: { userId }, // echoed back on the terminal webhook event
    });

    await createCallRecord({
      callId: call.id,
      userId,
      status: "queued",
      task,
      result: null,
      error: null,
    });

    return NextResponse.json({ callId: call.id, quotaRemaining: quota.remaining });
  } catch (error: unknown) {
    console.error("place-call failed:", error);
    if (error && typeof error === "object" && "details" in error) {
      console.error("validation details:", JSON.stringify((error as any).details, null, 2));
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}