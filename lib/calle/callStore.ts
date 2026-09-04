// lib/calle/callStore.ts
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv(); // same UPSTASH_REDIS_REST_URL/TOKEN as ratelimit.ts

export type CallStatus = "queued" | "in_progress" | "completed" | "failed";

export type CallRecord = {
  callId: string;
  userId: string;
  status: CallStatus;
  task: string;
  templateId?: string;
  result: unknown | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
};

const key = (callId: string) => `calle:call:${callId}`;
const TTL_SECONDS = 60 * 60 * 24 * 7; // keep records for 7 days

export async function createCallRecord(rec: Omit<CallRecord, "createdAt" | "updatedAt">) {
  const now = Date.now();
  const full: CallRecord = { ...rec, createdAt: now, updatedAt: now };
  await redis.set(key(rec.callId), full, { ex: TTL_SECONDS });
  return full;
}

export async function updateCallRecord(
  callId: string,
  patch: Partial<Pick<CallRecord, "status" | "result" | "error">>
) {
  const existing = await redis.get<CallRecord>(key(callId));
  if (!existing) return null;
  const updated: CallRecord = { ...existing, ...patch, updatedAt: Date.now() };
  await redis.set(key(callId), updated, { ex: TTL_SECONDS });
  return updated;
}

export async function getCallRecord(callId: string): Promise<CallRecord | null> {
  return redis.get<CallRecord>(key(callId));
}

export async function getCallRecordForUser(callId: string, userId: string) {
  const rec = await getCallRecord(callId);
  if (!rec || rec.userId !== userId) return null;
  return rec;
}

// Idempotency for webhook delivery — "at least once" per the docs.
export async function markEventProcessed(eventId: string): Promise<boolean> {
  // SET NX returns null if the key already existed — i.e. duplicate.
  const result = await redis.set(`calle:evt:${eventId}`, "1", {
    nx: true,
    ex: 60 * 60 * 24, // 24h is plenty for retry windows
  });
  return result !== null; // true = first time seeing this event
}