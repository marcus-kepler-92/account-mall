import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { config } from "@/lib/config"

/**
 * Redis client for agent rate limiting + quota counters.
 * Returns null when Upstash is not configured (local dev without
 * Upstash Marketplace integration); callers must handle null gracefully.
 */
function createRedis(): Redis | null {
  if (!config.upstashRedisRestUrl || !config.upstashRedisRestToken) return null
  return new Redis({
    url: config.upstashRedisRestUrl,
    token: config.upstashRedisRestToken,
  })
}

export const redis = createRedis()

export type LimiterKey = "chatIp" | "chatSession" | "chatFp" | "csReverse"

/**
 * Sliding-window rate limiters for the agent chat path. Backed by Upstash
 * Redis to survive Vercel multi-instance horizontal scaling (the in-memory
 * RateLimiterMemory in lib/rate-limit.ts can't share state across instances).
 *
 * Returns null when redis is not configured — callers (applyAntiAbuse,
 * /api/cs/* reverse routes) must treat that as "no limiting in dev" and
 * proceed.
 */
function buildLimiters(): Record<LimiterKey, Ratelimit> | null {
  if (!redis) return null
  return {
    chatIp: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      prefix: "agent:chat:ip",
      analytics: true,
    }),
    chatSession: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 h"),
      prefix: "agent:chat:session",
      analytics: true,
    }),
    chatFp: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(200, "1 d"),
      prefix: "agent:chat:fp",
      analytics: true,
    }),
    csReverse: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      prefix: "cs:reverse:ip",
      analytics: true,
    }),
  }
}

export const limiters = buildLimiters()
