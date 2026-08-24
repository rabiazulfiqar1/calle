import { NextRequest, NextResponse } from "next/server";
import { CalleClient } from "@call-e/calle";
import { templates, recipientSchema, userInfoSchema } from "../../../lib/templates";
import {handleVendorComparisonRequest} from "../../../lib/templates/vendorComparison";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.templateId === "vendor_comparison") {
    return handleVendorComparisonRequest(body);
  }

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

    return NextResponse.json({ result: call });
  } catch (err) {
    
    await fs.writeFile(
        path.join(process.cwd(), "tmp-call-error.json"),
        JSON.stringify({ error: String(err) }, null, 2)
    );
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}