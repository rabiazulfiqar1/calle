import { NextRequest, NextResponse } from "next/server";
import { updateCallRecord, markEventProcessed } from "@/lib/calle/callStore";

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

  if (event.type === "call.completed" || event.type === "call.result_validation_failed") {
    await updateCallRecord(callId, {
      status: "completed",
      result: data,
      error: null,
    });
  } else if (event.type === "call.failed") {
    await updateCallRecord(callId, {
      status: "failed",
      result: data,
      error: data.failure_message ?? "Call failed",
    });
  }

  return NextResponse.json({ ok: true });
}