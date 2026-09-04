import { NextRequest, NextResponse } from "next/server";
import { CalleClient } from "@call-e/calle";
import { templates, recipientSchema, userInfoSchema } from "../../../lib/templates";
import { getUserId } from "@/lib/auth/getUserId";
import { checkCallQuota } from "@/lib/ratelimit";
import { createCallRecord } from "@/lib/calle/callStore";

export async function POST(req: NextRequest) {
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

  const body = await req.json();
  const template = templates[body.templateId as keyof typeof templates];
  if (!template) {
    return NextResponse.json({ error: "Unknown template" }, { status: 400 });
  }

  const recipient = recipientSchema.safeParse(body.recipient);
  if (!recipient.success) {
    return NextResponse.json({ error: recipient.error.flatten() }, { status: 400 });
  }

  const user = userInfoSchema.safeParse(body.user ?? {});
  const details = template.detailsSchema.safeParse(body.details);
  if (!details.success) {
    return NextResponse.json({ error: details.error.flatten() }, { status: 400 });
  }

  const client = new CalleClient({ apiKey: process.env.CALLE_API_KEY! });
  const task = template.buildTask(details.data, user.data ?? {});

  try {
    const call = await client.calls.create({
      task,
      recipients: [{
        phones: [recipient.data.phone],
        region: recipient.data.region,
        locale: recipient.data.locale,
      }],
      resultSchema: template.resultSchema,
      recipientResultSchema: template.recipientResultSchema,
      webhookUrl: `${process.env.APP_BASE_URL}/api/calle/webhook`,
      metadata: { userId, templateId: body.templateId },
    });

    await createCallRecord({
      callId: call.id,
      userId,
      status: "queued",
      task,
      templateId: body.templateId,
      result: null,
      error: null,
    });

    return NextResponse.json({ callId: call.id, quotaRemaining: quota.remaining });
  } catch (err) {
    console.error("template call failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}