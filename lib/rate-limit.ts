import { RateLimiterMemory } from "rate-limiter-flexible"
import { NextRequest } from "next/server"
import { config } from "@/lib/config"

const ORDER_CREATE_POINTS = config.orderRateLimitPoints
const ORDER_CREATE_DURATION = 60 // 1 minute
const QUERY_LIMIT_POINTS = config.orderQueryRateLimitPoints
const QUERY_LIMIT_DURATION = 60

const orderCreateLimiter = new RateLimiterMemory({
    points: ORDER_CREATE_POINTS,
    duration: ORDER_CREATE_DURATION,
})

const orderQueryLimiter = new RateLimiterMemory({
    points: QUERY_LIMIT_POINTS,
    duration: QUERY_LIMIT_DURATION,
})

export function getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for")
    if (forwarded) {
        const first = forwarded.split(",")[0]?.trim()
        if (first) return first
    }
    const realIp = request.headers.get("x-real-ip")
    if (realIp) return realIp
    return "unknown"
}

/**
 * Check order create rate limit (e.g. 5 per minute per IP).
 * Returns null if allowed, or Response (429) if rate limited.
 */
export async function checkOrderCreateRateLimit(request: NextRequest): Promise<Response | null> {
    const key = getClientIp(request)
    if (key === "unknown") return null
    try {
        await orderCreateLimiter.consume(key)
        return null
    } catch {
        return new Response(
            JSON.stringify({ error: "Too many orders. Please try again later." }),
            { status: 429, headers: { "Content-Type": "application/json" } },
        )
    }
}

/**
 * Check order query (by-email / lookup) rate limit.
 */
export async function checkOrderQueryRateLimit(request: NextRequest): Promise<Response | null> {
    const key = getClientIp(request)
    if (key === "unknown") return null
    try {
        await orderQueryLimiter.consume(key)
        return null
    } catch {
        return new Response(
            JSON.stringify({ error: "Too many requests. Please try again later." }),
            { status: 429, headers: { "Content-Type": "application/json" } },
        )
    }
}

export const MAX_PENDING_ORDERS_PER_IP = config.maxPendingOrdersPerIp
