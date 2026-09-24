import { createHash } from "node:crypto";
import { TokenRateLimiter } from "@/lib/upstox/rate-limiter";

/**
 * Upstox documented API limits (per user / access token):
 * - 10 requests / second
 * - 500 requests / minute
 * - 2000 requests / 30 minutes
 *
 * We stay slightly below those caps in RATE_LIMITS. Limiters are shared
 * process-wide per token so parallel /api/upstox/data calls do not multiply quotas.
 */
const limiters = new Map<string, TokenRateLimiter>();

function tokenKey(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 24);
}

export function getSharedLimiterForToken(token: string): TokenRateLimiter {
  const key = tokenKey(token);
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new TokenRateLimiter();
    limiters.set(key, limiter);
  }
  return limiter;
}

/** Test helper — do not use in production routes. */
export function resetSharedLimitersForTests(): void {
  limiters.clear();
}
