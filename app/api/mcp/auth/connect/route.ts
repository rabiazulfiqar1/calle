import { NextRequest, NextResponse } from "next/server";
import { CalleMCPClient, CALLE_MCP_URL } from "@/lib/mcp/oauth-client";
import { calleSessionStore } from "@/lib/mcp/session-store";

export async function POST(request: NextRequest) {
  try {
    const callbackUrl = `${request.nextUrl.origin}/api/mcp/auth/callback`;
    const sessionId = calleSessionStore.generateSessionId();
    let authUrl: string | null = null;

    const client = new CalleMCPClient(CALLE_MCP_URL, callbackUrl, (redirectUrl) => {
      authUrl = redirectUrl;
    });

    try {
      await client.connect();
      calleSessionStore.setClient(sessionId, client);
      return NextResponse.json({ success: true, sessionId });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "OAuth authorization required" && authUrl) {
        calleSessionStore.setClient(sessionId, client);
        return NextResponse.json({ requiresAuth: true, authUrl, sessionId }, { status: 401 });
      }
      throw error;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}