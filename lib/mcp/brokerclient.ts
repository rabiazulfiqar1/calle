import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_BASE_URL = "https://seleven-mcp-sg.airudder.com";
const DEFAULT_CHANNEL = "openagent_oauth";
const DEFAULT_SCOPE = "openid email profile";
const DEFAULT_CLIENT_NAME = "Two Phase Work (calle)";
const MCP_PROTOCOL_VERSION = "2025-11-25";
const INTEGRATION_HEADER = "X-Call-E-Integration";
const SESSION_SECRET_HEADER = "X-OpenAgent-Session-Secret";

type Config = {
  baseUrl: string;
  serverUrl: string;
  brokerBaseUrl: string;
  authBaseUrl: string;
  channel: string;
  scope: string;
  clientName: string;
  cacheRoot: string;
  timeoutSeconds: number;
  minTtlSeconds: number;
  pollTimeoutSeconds: number;
  integrationHeader: string;
};

type PendingLogin = {
  session_id: string;
  session_secret: string;
  login_url: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  error_message: string | null;
  poll_after_ms: number | null;
};

type McpSession = {
  serverUrl: string;
  headers: Record<string, string>;
  timeoutMs: number;
};

export class McpHttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | null = null,
    public readonly code = "mcp_error"
  ) {
    super(message);
    this.name = "McpHttpError";
  }
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/u, "");
}

function resolveServerUrl(baseUrl: string, channel: string) {
  return `${normalizeBaseUrl(baseUrl)}/mcp/${channel}`;
}

function readConfig(env = process.env): Config {
  const baseUrl = env.MCP_BASE_URL || DEFAULT_BASE_URL;
  const channel = env.MCP_CHANNEL || DEFAULT_CHANNEL;
  return {
    baseUrl,
    serverUrl: env.MCP_SERVER_URL || resolveServerUrl(baseUrl, channel),
    brokerBaseUrl: normalizeBaseUrl(env.MCP_BROKER_BASE_URL || baseUrl),
    authBaseUrl: normalizeBaseUrl(env.MCP_AUTH_BASE_URL || baseUrl),
    channel,
    scope: env.MCP_SCOPE || DEFAULT_SCOPE,
    clientName: env.MCP_CLIENT_NAME || DEFAULT_CLIENT_NAME,
    // Stored outside the project dir, like the original example — keeps
    // the token off Next.js's watched file tree (avoids dev-server reloads)
    cacheRoot: path.join(os.homedir(), ".calle-mcp", "two-phase-work"),
    timeoutSeconds: 15,
    minTtlSeconds: 300,
    pollTimeoutSeconds: 300,
    integrationHeader: "app/two-phase-work/0.0.0",
  };
}

function serverHash(serverUrl: string) {
  return crypto.createHash("md5").update(serverUrl, "utf8").digest("hex");
}

function tokenCachePath(config: Config) {
  return path.join(config.cacheRoot, serverHash(config.serverUrl), "token.json");
}

function pendingCachePath(config: Config) {
  return path.join(config.cacheRoot, serverHash(config.serverUrl), "pending_login.json");
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writePrivateJson(filePath: string, payload: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {}
}

function removeFile(filePath: string) {
  try {
    fs.rmSync(filePath, { force: true });
  } catch {}
}

function parseIsoDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function tokenIsUsable(document: Record<string, unknown> | null, minTtlSeconds: number) {
  if (!document) return false;
  const token = document.token;
  if (!token || typeof token !== "object" || typeof (token as Record<string, unknown>).access_token !== "string") {
    return false;
  }
  const expiresAt = parseIsoDate(document.expires_at);
  if (!expiresAt) return true;
  return expiresAt.getTime() - Date.now() > minTtlSeconds * 1000;
}

function normalizePendingLogin(value: Record<string, unknown> | null): PendingLogin | null {
  if (!value) return null;
  for (const field of ["session_id", "session_secret", "login_url", "status", "created_at"]) {
    if (typeof value[field] !== "string" || !value[field]) return null;
  }
  return {
    session_id: String(value.session_id),
    session_secret: String(value.session_secret),
    login_url: String(value.login_url),
    status: String(value.status).toUpperCase(),
    created_at: String(value.created_at),
    expires_at: typeof value.expires_at === "string" ? value.expires_at : null,
    error_message: typeof value.error_message === "string" ? value.error_message : null,
    poll_after_ms: Number(value.poll_after_ms || 0) || null,
  };
}

function pendingIsExpired(pending: PendingLogin | null) {
  const expiresAt = parseIsoDate(pending?.expires_at);
  return Boolean(expiresAt && Date.now() >= expiresAt.getTime());
}

async function requestJson(
  method: string,
  url: string,
  { headers = {}, json }: { headers?: Record<string, string>; json?: unknown } = {}
) {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json === undefined ? undefined : JSON.stringify(json),
  });
  const text = await response.text();
  const body = text.trim() ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${method} ${url}`);
  }
  return body as Record<string, unknown>;
}

async function createBrokerSession(config: Config): Promise<PendingLogin> {
  const payload = await requestJson("POST", `${config.brokerBaseUrl}/api/v1/openagent-auth/sessions`, {
    headers: { [INTEGRATION_HEADER]: config.integrationHeader },
    json: {
      server_url: config.serverUrl,
      auth_base_url: config.authBaseUrl,
      channel: config.channel,
      scope: config.scope,
      client_name: config.clientName,
    },
  });
  return {
    session_id: String(payload.session_id),
    session_secret: String(payload.session_secret),
    login_url: String(payload.login_url),
    status: String(payload.status || "PENDING").toUpperCase(),
    created_at: new Date().toISOString(),
    expires_at: typeof payload.expires_at === "string" ? payload.expires_at : null,
    error_message: null,
    poll_after_ms: Number(payload.poll_after_ms || 0) || null,
  };
}

async function getBrokerStatus(config: Config, pending: PendingLogin) {
  return requestJson("GET", `${config.brokerBaseUrl}/api/v1/openagent-auth/sessions/${pending.session_id}`, {
    headers: {
      [SESSION_SECRET_HEADER]: pending.session_secret,
      [INTEGRATION_HEADER]: config.integrationHeader,
    },
  });
}

async function exchangeBrokerSession(config: Config, pending: PendingLogin) {
  return requestJson("POST", `${config.brokerBaseUrl}/api/v1/openagent-auth/sessions/${pending.session_id}/exchange`, {
    headers: {
      [SESSION_SECRET_HEADER]: pending.session_secret,
      [INTEGRATION_HEADER]: config.integrationHeader,
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a cached, still-valid token if one exists. Otherwise starts a
 * broker login and returns { loginRequired: true, loginUrl } WITHOUT
 * blocking — the caller (a one-time setup script) is responsible for
 * showing that URL to a human and calling waitForBrokerLogin() after.
 */
export async function getCachedTokenOrStartLogin(): Promise<
  | { loginRequired: false; token: Record<string, unknown> }
  | { loginRequired: true; loginUrl: string }
> {
  const config = readConfig();
  const cachePath = tokenCachePath(config);
  const cached = readJson(cachePath);
  if (tokenIsUsable(cached, config.minTtlSeconds)) {
    return { loginRequired: false, token: cached as Record<string, unknown> };
  }

  const pendingPath = pendingCachePath(config);
  let pending = normalizePendingLogin(readJson(pendingPath));
  if (!pending || pendingIsExpired(pending)) {
    if (pending) removeFile(pendingPath);
    pending = await createBrokerSession(config);
    writePrivateJson(pendingPath, pending);
  }
  return { loginRequired: true, loginUrl: pending.login_url };
}

/** Polls until the pending login (started above) completes, then caches the token. */
export async function waitForBrokerLogin(): Promise<Record<string, unknown>> {
  const config = readConfig();
  const pendingPath = pendingCachePath(config);
  const cachePath = tokenCachePath(config);

  let pending = normalizePendingLogin(readJson(pendingPath));
  if (!pending) throw new Error("No pending login found — call getCachedTokenOrStartLogin() first.");

  const deadline = Date.now() + config.pollTimeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const statusPayload = await getBrokerStatus(config, pending);
    pending = {
      ...pending,
      status: String(statusPayload.status || pending.status).toUpperCase(),
      expires_at: typeof statusPayload.expires_at === "string" ? statusPayload.expires_at : pending.expires_at,
      error_message: typeof statusPayload.error_message === "string" ? statusPayload.error_message : null,
      poll_after_ms: Number(statusPayload.poll_after_ms || 0) || pending.poll_after_ms || null,
    };
    writePrivateJson(pendingPath, pending);

    if (pending.status === "AUTHORIZED") {
      const exchanged = await exchangeBrokerSession(config, pending);
      writePrivateJson(cachePath, exchanged);
      removeFile(pendingPath);
      return exchanged;
    }
    if (["FAILED", "EXPIRED", "EXCHANGED"].includes(pending.status)) {
      removeFile(pendingPath);
      throw new Error(`Brokered login failed: ${pending.error_message || pending.status}`);
    }
    await sleep(Math.max(1, Math.min(Number(pending.poll_after_ms || 1000), 10000)));
  }
  throw new Error("Timed out waiting for brokered login authorization.");
}

export function clearBrokerState() {
  const config = readConfig();
  removeFile(tokenCachePath(config));
  removeFile(pendingCachePath(config));
}

function accessTokenFromDocument(document: Record<string, unknown>) {
  const token = document.token;
  if (!token || typeof token !== "object" || typeof (token as Record<string, unknown>).access_token !== "string") {
    throw new Error("Token cache does not contain an access token.");
  }
  return String((token as Record<string, unknown>).access_token);
}

function jsonRpcPayload(id: string | undefined, method: string, params?: Record<string, unknown>) {
  return { jsonrpc: "2.0", ...(id !== undefined ? { id } : {}), method, ...(params !== undefined ? { params } : {}) };
}

async function postJsonRpc(session: McpSession, payload: Record<string, unknown>) {
  const response = await fetch(session.serverUrl, {
    method: "POST",
    headers: session.headers,
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  const body = text.trim() ? JSON.parse(text) : {};
  if (!response.ok) {
    const code = response.status === 401 || response.status === 403 ? "auth_required" : "mcp_http_error";
    throw new McpHttpError(`MCP HTTP ${response.status} for ${payload.method}`, response.status, code);
  }
  if (body?.error) {
    throw new McpHttpError(body.error.message || `MCP error for ${payload.method}`);
  }
  return { body, headers: response.headers };
}

async function openMcpSession(config: Config, accessToken: string): Promise<McpSession> {
  const commonHeaders = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    "mcp-protocol-version": MCP_PROTOCOL_VERSION,
    Authorization: `Bearer ${accessToken}`,
    [INTEGRATION_HEADER]: config.integrationHeader,
  };
  const initSession = { serverUrl: config.serverUrl, headers: commonHeaders, timeoutMs: config.timeoutSeconds * 1000 };
  const initialize = await postJsonRpc(
    initSession,
    jsonRpcPayload("two-phase-init", "initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "two-phase-work-app", version: "1.0.0" },
    })
  );
  const sessionId = initialize.headers.get("mcp-session-id") || "";
  const session = { ...initSession, headers: sessionId ? { ...commonHeaders, "mcp-session-id": sessionId } : commonHeaders };
  await postJsonRpc(session, jsonRpcPayload(undefined, "notifications/initialized", {}));
  return session;
}

async function mcpRequest(session: McpSession, method: string, params: Record<string, unknown> = {}) {
  const response = await postJsonRpc(session, jsonRpcPayload(`two-phase-${method}-${Date.now()}`, method, params));
  return response.body?.result || {};
}

/** Extracts structuredContent, falling back to parsing content[].text as JSON. */
function extractStructured(result: Record<string, unknown>): any {
  if (result.structuredContent) return result.structuredContent;
  const content = Array.isArray(result.content) ? result.content : [];
  for (const block of content) {
    if (block?.type === "text" && typeof block.text === "string") {
      try {
        return JSON.parse(block.text);
      } catch {
        continue;
      }
    }
  }
  return result;
}

/**
 * Cached MCP session, reused across tool calls within this server process.
 * Skips the initialize handshake (2 extra network round-trips) on every
 * call — this is overhead WE control, unlike CALL-E's own planning/dialing
 * time. Invalidated automatically if a call fails against it.
 */
let cachedSession: McpSession | null = null;
let cachedSessionTokenSignature: string | null = null;

/**
 * High-level entry point for API routes: ensures a valid cached token
 * exists (throws a clear error if not — run the setup script first),
 * reuses an open MCP session when possible, calls the given tool, and
 * returns the extracted structured result.
 */
export async function callCalleTool(toolName: string, args: Record<string, unknown>): Promise<any> {
  const tokenState = await getCachedTokenOrStartLogin();
  if (tokenState.loginRequired) {
    throw new Error(
      `Not authorized yet. Run the setup script first: npx tsx scripts/calle-mcp-login.ts\n(Login URL: ${tokenState.loginUrl})`
    );
  }

  const config = readConfig();
  const accessToken = accessTokenFromDocument(tokenState.token);

  // Reuse the cached session unless the token changed since it was opened
  // (e.g. after a re-login) — cheap signature check, no extra network call.
  if (!cachedSession || cachedSessionTokenSignature !== accessToken) {
    cachedSession = await openMcpSession(config, accessToken);
    cachedSessionTokenSignature = accessToken;
  }

  async function attempt(session: McpSession) {
    const result = await mcpRequest(session, "tools/call", { name: toolName, arguments: args });
    return extractStructured(result);
  }

  try {
    return await attempt(cachedSession);
  } catch (error) {
    if (error instanceof McpHttpError && error.code === "auth_required") {
      clearBrokerState();
      cachedSession = null;
      throw new Error("CALL-E rejected the cached token. Run the setup script again: npx tsx scripts/calle-mcp-login.ts");
    }
    // Session may have gone stale server-side for other reasons (e.g. expiry) —
    // retry once with a freshly opened session before giving up.
    cachedSession = await openMcpSession(config, accessToken);
    cachedSessionTokenSignature = accessToken;
    return await attempt(cachedSession);
  }
}