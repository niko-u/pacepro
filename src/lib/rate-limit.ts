/**
 * Simple in-memory sliding window rate limiter.
 *
 * NOTE: Vercel serverless functions are stateless — this rate limiter resets
 * between cold starts. It still provides useful protection against rapid-fire
 * abuse within a single instance lifetime. For production-grade rate limiting,
 * use Upstash Redis (@upstash/ratelimit) which works across all instances:
 *
 *   import { Ratelimit } from "@upstash/ratelimit";
 *   import { Redis } from "@upstash/redis";
 *   const ratelimit = new Ratelimit({
 *     redis: Redis.fromEnv(),
 *     limiter: Ratelimit.slidingWindow(30, "1 m"),
 *   });
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Periodically clean up stale entries (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStaleEntries(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const cutoff = now - windowMs * 2; // Keep entries within 2x the window
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the window resets */
  resetAt: number;
}

/**
 * Check rate limit for a given key (typically userId + action).
 * Uses a sliding window approach.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Lazy cleanup
  cleanupStaleEntries(config.windowMs);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the sliding window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= config.maxRequests) {
    // Rate limit exceeded
    const oldestInWindow = entry.timestamps[0];
    const resetAt = oldestInWindow + config.windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  // Allow the request
  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    resetAt: now + config.windowMs,
  };
}

// ─── Pre-configured rate limiters ──────────────────────────────────────────

/** Chat: 30 messages per minute per user */
export function checkChatRateLimit(userId: string): RateLimitResult {
  return checkRateLimit(`chat:${userId}`, {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
  });
}

/** Plan generation: 3 requests per hour per user */
export function checkPlanGenerationRateLimit(userId: string): RateLimitResult {
  return checkRateLimit(`plan-gen:${userId}`, {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
  });
}
