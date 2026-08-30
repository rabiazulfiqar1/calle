import { NextRequest, NextResponse } from "next/server";
import { CalleClient } from "@call-e/calle";
import { templates, recipientSchema, userInfoSchema } from "../../../lib/templates";
import { getUserId } from "@/lib/auth/getUserId";
import { checkCallQuota } from "@/lib/ratelimit";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Templates place a REAL call — same shared quota as place-call.
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

  try {
    const call = await client.calls.createAndWait({
      task: template.buildTask(details.data, user.data ?? {}),
      recipients: [{
        phones: [recipient.data.phone],
        region: recipient.data.region,
        locale: recipient.data.locale,
      }],
      resultSchema: template.resultSchema,
      recipientResultSchema: template.recipientResultSchema,
    });

    await fs.writeFile(
        path.join(process.cwd(), "tmp-call-result.json"),
        JSON.stringify(call, null, 2)
    );

    return NextResponse.json({ result: call, quotaRemaining: quota.remaining });
  } catch (err) {

    await fs.writeFile(
        path.join(process.cwd(), "tmp-call-error.json"),
        JSON.stringify({ error: String(err) }, null, 2)
    );
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}