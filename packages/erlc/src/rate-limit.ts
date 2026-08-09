import type { ErlcRateLimit } from "./types";

/**
 * A minimal token-bucket limiter. The PRC ER:LC API enforces per-bucket rate
 * limits; this proactively throttles outbound calls so we cooperate with the
 * server-reported limits instead of hammering into 429s.
 */
export class TokenBucket {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private lastRefill: number;

  constructor(options: { capacity: number; refillPerSecond: number; now?: () => number }) {
    this.capacity = options.capacity;
    this.tokens = options.capacity;
    this.refillPerMs = options.refillPerSecond / 1000;
    this.lastRefill = (options.now ?? Date.now)();
  }

  private refill(now: number): void {
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefill = now;
  }

  /** Milliseconds the caller must wait before a token is available (0 if ready). */
  reserve(now: number): number {
    this.refill(now);
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return 0;
    }
    const deficit = 1 - this.tokens;
    return Math.ceil(deficit / this.refillPerMs);
  }
}

/** Parse ER:LC / PRC rate-limit headers into a structured value. */
export function parseRateLimitHeaders(headers: Headers): ErlcRateLimit {
  const bucket = headers.get("x-ratelimit-bucket");
  const limitRaw = headers.get("x-ratelimit-limit");
  const remainingRaw = headers.get("x-ratelimit-remaining");
  const resetRaw = headers.get("x-ratelimit-reset");

  const limit = limitRaw !== null && limitRaw !== "" ? Number(limitRaw) : null;
  const remaining = remainingRaw !== null && remainingRaw !== "" ? Number(remainingRaw) : null;
  let resetAt: Date | null = null;
  if (resetRaw !== null && resetRaw !== "") {
    const resetNum = Number(resetRaw);
    if (Number.isFinite(resetNum)) {
      // PRC returns a unix epoch (seconds) reset timestamp.
      resetAt = new Date(resetNum * 1000);
    }
  }

  return {
    bucket,
    limit: limit !== null && Number.isFinite(limit) ? limit : null,
    remaining: remaining !== null && Number.isFinite(remaining) ? remaining : null,
    resetAt,
  };
}

/** Derive a retry delay (ms) from a 429 response. */
export function retryAfterFromResponse(headers: Headers, now: number): number {
  const retryAfter = headers.get("retry-after");
  if (retryAfter !== null && retryAfter !== "") {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds * 1000));
  }
  const parsed = parseRateLimitHeaders(headers);
  if (parsed.resetAt) {
    return Math.max(0, parsed.resetAt.getTime() - now);
  }
  return 1000;
}
