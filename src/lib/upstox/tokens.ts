import { getSharedLimiterForToken } from "@/lib/upstox/limiter-registry";
import type { TokenRateLimiter } from "@/lib/upstox/rate-limiter";

export function envFallbackTokens(): string[] {
  const keys = [
    process.env.UPSTOX_ACCESS_TOKEN_1,
    process.env.UPSTOX_ACCESS_TOKEN_2,
    process.env.UPSTOX_ACCESS_TOKEN_3,
    process.env.UPSTOX_ACCESS_TOKEN_4,
  ];
  return keys
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean);
}

export function dedupeTokens(tokens: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tokens) {
    const t = raw.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.slice(0, 4);
}

export function resolveRequestTokens(body: {
  accessToken?: string;
  accessTokens?: string[];
}): string[] {
  const fromBody: string[] = [];
  if (Array.isArray(body.accessTokens)) {
    fromBody.push(...body.accessTokens);
  }
  if (body.accessToken?.trim()) {
    fromBody.unshift(body.accessToken.trim());
  }
  const dialog = dedupeTokens(fromBody);
  if (dialog.length > 0) return dialog;
  return dedupeTokens(envFallbackTokens());
}

export class TokenLane {
  readonly id: number;
  readonly token: string;
  readonly limiter: TokenRateLimiter;
  invalid = false;
  invalidReason?: string;

  constructor(id: number, token: string) {
    this.id = id;
    this.token = token;
    this.limiter = getSharedLimiterForToken(token);
  }

  markInvalid(reason: string): void {
    this.invalid = true;
    this.invalidReason = reason;
  }
}

export function createTokenLanes(tokens: string[]): TokenLane[] {
  return tokens.map((token, index) => new TokenLane(index, token));
}

export function activeLanes(lanes: TokenLane[]): TokenLane[] {
  return lanes.filter((lane) => !lane.invalid);
}
