import { NextRequest, NextResponse } from "next/server";
import { CalleClient } from "@call-e/calle";
import { templates, recipientSchema, userInfoSchema } from "../../../lib/templates";
import {
  vendorComparisonDetailsSchema,
  buildVendorTask,
  buildVendorResultSchema,
} from "../../../lib/templates/vendorComparison";
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
        error: `Daily call limit reached (${quota.limit}/day). Resets at ${new Date(
          quota.resetAt
        ).toLocaleString()}.`,
      },
      { status: 429 }
    );
  }

  const body = await req.json();
  const client = new CalleClient({ apiKey: process.env.CALLE_API_KEY! });

  // ── Vendor comparison: one call, multiple recipients, resolved async in the webhook ──
  if (body.templateId === "vendor_comparison") {
    const details = vendorComparisonDetailsSchema.safeParse(body.details);
    if (!details.success) {
      return NextResponse.json({ error: details.error.flatten() }, { status: 400 });
    }

    const fieldLabels = details.data.fieldsToAsk;
    const vendorNames = details.data.vendors.map((v: any) => v.businessName);
    const task = buildVendorTask(details.data);

    try {
      const call = await client.calls.create({
        task,
        recipients: details.data.vendors.map((v: any) => ({
          phones: [v.contact.phone],
          region: v.contact.region,
          locale: v.contact.locale,
        })),
        resultSchema: {
          type: "object",
          required: ["answer", "evidence"],
          properties: {
            answer: { type: "string", enum: ["yes", "no", "not sure"] },
            evidence: { type: "string" },
          },
          additionalProperties: false,
        },
        recipientResultSchema: buildVendorResultSchema(fieldLabels),
        webhookUrl: `${process.env.APP_BASE_URL}/api/calle/webhook`,
        // fieldLabels/vendorNames/service ride along in metadata so the webhook
        // can run compareVendors() once results land, without re-fetching anything
        metadata: {
          userId,
          templateId: "vendor_comparison",
          fieldLabels,
          vendorNames,
          service: details.data.service,
        },
      });

      await createCallRecord({
        callId: call.id,
        userId,
        status: "queued",
        task,
        templateId: "vendor_comparison",
        result: null,
        error: null,
      });

      return NextResponse.json({ callId: call.id, quotaRemaining: quota.remaining });
    } catch (err) {
      console.error("vendor comparison call failed:", err);
      return NextResponse.json({ error: String(err) }, { status: 502 });
    }
  }

  // ── Standard single-recipient templates ──
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

  const task = template.buildTask(details.data, user.data ?? {});

  try {
    const call = await client.calls.create({
      task,
      recipients: [
        { phones: [recipient.data.phone], region: recipient.data.region, locale: recipient.data.locale },
      ],
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