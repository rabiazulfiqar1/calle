import { NextRequest, NextResponse } from "next/server";
import { updateCallRecord, markEventProcessed } from "@/lib/calle/callStore";
import { compareVendors } from "@/lib/templates/vendorComparison";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId = request.headers.get("CALL-E-Event-Id");
  if (!eventId || eventId !== event.id) {
    return NextResponse.json({ error: "invalid event id" }, { status: 400 });
  }

  // Idempotency — webhook delivery is at-least-once.
  const firstTime = await markEventProcessed(event.id);
  if (!firstTime) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const data = event.data;
  const callId: string = data.id;
  // metadata is whatever was passed at `calls.create()` time, echoed back here —
  // for vendor comparisons that's { templateId, vendorNames, fieldLabels, service }
  const metadata = data.metadata ?? {};

  if (event.type === "call.completed" || event.type === "call.result_validation_failed") {
    if (metadata.templateId === "vendor_comparison") {
      const recipientResults = (data.recipients ?? []).map((r: any) => r.structuredResult);

      let comparison;
      try {
        comparison = await compareVendors(
          metadata.vendorNames ?? [],
          recipientResults,
          metadata.fieldLabels ?? [],
          metadata.service ?? ""
        );
      } catch (err) {
        console.error("vendor comparison scoring failed:", err);
        comparison = {
          method: "none" as const,
          winner: null,
          reasoning: "Comparison could not be computed due to an internal error.",
        };
      }

      await updateCallRecord(callId, {
        status: "completed",
        result: { ...data, comparison },
        error: null,
      });
    } else {
      await updateCallRecord(callId, {
        status: "completed",
        result: data,
        error: null,
      });
    }
  } else if (event.type === "call.failed") {
    await updateCallRecord(callId, {
      status: "failed",
      result: data,
      error: data.failure_message ?? "Call failed",
    });
  }

  return NextResponse.json({ ok: true });
}