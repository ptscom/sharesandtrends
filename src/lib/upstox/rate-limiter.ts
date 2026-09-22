/** Conservative Upstox limits per token lane. */
export type RateLimitConfig = {
  maxPerSecond: number;
  maxPerMinute: number;
  maxPer30Minutes: number;
  maxHistoricalInFlight: number;
};

export const RATE_LIMITS: RateLimitConfig = {
  maxPerSecond: 8,
  maxPerMinute: 420,
  maxPer30Minutes: 1800,
  maxHistoricalInFlight: 8,
};

type TimestampMs = number;

export class TokenRateLimiter {
  private readonly secondWindow: TimestampMs[] = [];
  private readonly minuteWindow: TimestampMs[] = [];
  private readonly halfHourWindow: TimestampMs[] = [];
  private inFlight = 0;

  constructor(private readonly limits: RateLimitConfig = RATE_LIMITS) {}

  private prune(now: number): void {
    const cutSecond = now - 1000;
    const cutMinute = now - 60_000;
    const cutHalfHour = now - 30 * 60_000;
    while (this.secondWindow.length && this.secondWindow[0] < cutSecond) {
      this.secondWindow.shift();
    }
    while (this.minuteWindow.length && this.minuteWindow[0] < cutMinute) {
      this.minuteWindow.shift();
    }
    while (this.halfHourWindow.length && this.halfHourWindow[0] < cutHalfHour) {
      this.halfHourWindow.shift();
    }
  }

  private canStart(now: number): boolean {
    this.prune(now);
    return (
      this.secondWindow.length < this.limits.maxPerSecond &&
      this.minuteWindow.length < this.limits.maxPerMinute &&
      this.halfHourWindow.length < this.limits.maxPer30Minutes &&
      this.inFlight < this.limits.maxHistoricalInFlight
    );
  }

  private waitMs(now: number): number {
    this.prune(now);
    const waits: number[] = [];
    if (this.secondWindow.length >= this.limits.maxPerSecond) {
      waits.push(1000 - (now - this.secondWindow[0]) + 5);
    }
    if (this.minuteWindow.length >= this.limits.maxPerMinute) {
      waits.push(60_000 - (now - this.minuteWindow[0]) + 5);
    }
    if (this.halfHourWindow.length >= this.limits.maxPer30Minutes) {
      waits.push(30 * 60_000 - (now - this.halfHourWindow[0]) + 5);
    }
    if (this.inFlight >= this.limits.maxHistoricalInFlight) {
      waits.push(50);
    }
    return Math.max(0, ...waits, 0);
  }

  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      if (this.canStart(now)) {
        this.secondWindow.push(now);
        this.minuteWindow.push(now);
        this.halfHourWindow.push(now);
        this.inFlight += 1;
        return;
      }
      const delay = this.waitMs(now);
      await new Promise((r) => setTimeout(r, Math.min(delay, 500)));
    }
  }

  release(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
