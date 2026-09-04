import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * RATE LIMIT — cheap, frequent actions (planning, checking status).
 * Prevents abuse/spam, not about cost. Sliding window: 10 requests/minute.
 */
const planLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "ratelimit:plan",
  analytics: true,
});

/**
 * QUOTA — expensive actions that place a REAL phone call. Shared across
 * the whole app (templates + two-phase) since it's the same underlying
 * CALL-E account and cost regardless of which feature triggered it.
 * Fixed window: 5 real calls per user per day.
 */
const callQuota = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(100, "1 d"),
  prefix: "quota:calls",
  analytics: true,
});

export type LimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // unix ms
};

async function check(limiter: Ratelimit, userId: string): Promise<LimitResult> {
  const { success, limit, remaining, reset } = await limiter.limit(userId);
  return { allowed: success, limit, remaining, resetAt: reset };
}

/** Call before any "planning" action (plan_call, etc.) */
export function checkPlanRateLimit(userId: string) {
  return check(planLimiter, userId);
}

/** Call before any action that ACTUALLY PLACES A REAL PHONE CALL. */
export function checkCallQuota(userId: string) {
  return check(callQuota, userId);
}