import { NextRequest, NextResponse } from "next/server";
import { calleSessionStore } from "@/lib/mcp/session-store";

export async function POST(request: NextRequest) {
  try {
    const { authCode, sessionId } = await request.json();

    if (!authCode || !sessionId) {
      return NextResponse.json({ error: "authCode and sessionId are required" }, { status: 400 });
    }

    const client = calleSessionStore.getClient(sessionId);
    if (!client) {
      return NextResponse.json({ error: "No active OAuth session found" }, { status: 400 });
    }

    await client.finishAuth(authCode);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}