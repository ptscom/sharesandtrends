import type { TokenRateLimiter } from "@/lib/upstox/rate-limiter";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

export type UpstoxFetchResult = {
  response: Response;
  attempt: number;
};

function jitter(ms: number): number {
  return ms + Math.floor(Math.random() * 200);
}

function delayForAttempt(attempt: number, retryAfterSec?: number): number {
  if (retryAfterSec && retryAfterSec > 0) {
    return jitter(retryAfterSec * 1000);
  }
  const base = [1000, 2000, 4000][attempt - 1] ?? 4000;
  return jitter(base);
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function fetchOnce(
  url: string,
  init: RequestInit & { token: string },
  timeoutMs: number,
  limiter?: TokenRateLimiter,
): Promise<Response> {
  if (limiter) await limiter.acquire();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${init.token}`,
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
    if (limiter) limiter.release();
  }
}

export async function upstoxFetch(
  url: string,
  init: RequestInit & { token: string },
  options?: {
    timeoutMs?: number;
    maxRetries?: number;
    limiter?: TokenRateLimiter;
  },
): Promise<{ response: Response; attempts: number }> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options?.maxRetries ?? MAX_RETRIES;
  const limiter = options?.limiter;
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    attempt += 1;
    try {
      const response = await fetchOnce(url, init, timeoutMs, limiter);

      if (response.ok) {
        return { response, attempts: attempt };
      }

      if (response.status === 401 || response.status === 403) {
        return { response, attempts: attempt };
      }

      if (response.status === 400) {
        return { response, attempts: attempt };
      }

      if (isRetryableStatus(response.status) && attempt <= maxRetries) {
        const retryAfter = response.headers.get("Retry-After");
        const sec = retryAfter ? Number(retryAfter) : undefined;
        await new Promise((r) =>
          setTimeout(r, delayForAttempt(attempt, Number.isFinite(sec) ? sec : undefined)),
        );
        continue;
      }

      return { response, attempts: attempt };
    } catch (e) {
      lastError = e;
      if (attempt <= maxRetries) {
        await new Promise((r) => setTimeout(r, delayForAttempt(attempt)));
        continue;
      }
      throw lastError instanceof Error ? lastError : new Error("Network request failed");
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}
