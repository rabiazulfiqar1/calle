import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth/getUserId";
import { getCallRecordForUser } from "@/lib/calle/callStore";

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const callId = request.nextUrl.searchParams.get("id");
  if (!callId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const rec = await getCallRecordForUser(callId, userId);
  if (!rec) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: rec.status,
    result: rec.result,
    error: rec.error,
  });
}