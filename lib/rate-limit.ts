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

/** 优惠码校验：每 IP 每分钟最多 30 次（防抖后够用） */
const VALIDATE_PROMO_POINTS = 30
const VALIDATE_PROMO_DURATION = 60
const validatePromoLimiter = new RateLimiterMemory({
    points: VALIDATE_PROMO_POINTS,
    duration: VALIDATE_PROMO_DURATION,
})

/** 提现申请：每用户每分钟最多 10 次 */
const WITHDRAWAL_CREATE_POINTS = 10
const WITHDRAWAL_CREATE_DURATION = 60
const withdrawalCreateLimiter = new RateLimiterMemory({
    points: WITHDRAWAL_CREATE_POINTS,
    duration: WITHDRAWAL_CREATE_DURATION,
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
 * Skipped in development (no 风控).
 */
export async function checkOrderCreateRateLimit(request: NextRequest): Promise<Response | null> {
    if (config.nodeEnv === "development") return null
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
 * Check withdrawal create rate limit (per distributor user).
 * Key = userId. Skipped in development.
 */
export async function checkWithdrawalCreateRateLimit(userId: string): Promise<Response | null> {
    if (config.nodeEnv === "development") return null
    const key = `withdrawal:${userId}`
    try {
        await withdrawalCreateLimiter.consume(key)
        return null
    } catch {
        return new Response(
            JSON.stringify({ error: "提现申请过于频繁，请稍后再试。" }),
            { status: 429, headers: { "Content-Type": "application/json" } },
        )
    }
}

/**
 * Check validate-promo-code rate limit (per IP).
 * Skipped in development.
 */
export async function checkValidatePromoCodeRateLimit(request: NextRequest): Promise<Response | null> {
    if (config.nodeEnv === "development") return null
    const key = getClientIp(request)
    if (key === "unknown") return null
    try {
        await validatePromoLimiter.consume(key)
        return null
    } catch {
        return new Response(
            JSON.stringify({ error: "请求过于频繁，请稍后再试。" }),
            { status: 429, headers: { "Content-Type": "application/json" } },
        )
    }
}

/**
 * Check order query (by-email / lookup) rate limit.
 * Skipped in development (no 风控).
 */
export async function checkOrderQueryRateLimit(request: NextRequest): Promise<Response | null> {
    if (config.nodeEnv === "development") return null
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

/** 接受邀请注册：每 IP 每分钟最多 10 次 */
const ACCEPT_INVITE_POINTS = 10
const ACCEPT_INVITE_DURATION = 60
const acceptInviteLimiter = new RateLimiterMemory({
    points: ACCEPT_INVITE_POINTS,
    duration: ACCEPT_INVITE_DURATION,
})

/** 分销员发送邀请：每用户每小时最多 3 次 */
const DISTRIBUTOR_INVITE_POINTS = 3
const DISTRIBUTOR_INVITE_DURATION = 3600
const distributorInviteLimiter = new RateLimiterMemory({
    points: DISTRIBUTOR_INVITE_POINTS,
    duration: DISTRIBUTOR_INVITE_DURATION,
})

export async function checkAcceptInviteRateLimit(request: NextRequest): Promise<Response | null> {
    if (config.nodeEnv === "development") return null
    const key = getClientIp(request)
    if (key === "unknown") return null
    try {
        await acceptInviteLimiter.consume(key)
        return null
    } catch {
        return new Response(
            JSON.stringify({ error: "请求过于频繁，请稍后再试。" }),
            { status: 429, headers: { "Content-Type": "application/json" } },
        )
    }
}

export async function checkDistributorInviteRateLimit(userId: string): Promise<Response | null> {
    if (config.nodeEnv === "development") return null
    const key = `dist-invite:${userId}`
    try {
        await distributorInviteLimiter.consume(key)
        return null
    } catch {
        return new Response(
            JSON.stringify({ error: "邀请发送过于频繁，请稍后再试。" }),
            { status: 429, headers: { "Content-Type": "application/json" } },
        )
    }
}

/** Turnstile 降级路径（无 token 仅 fingerprint）：每 IP 每 10 分钟最多 2 次 */
const TURNSTILE_FALLBACK_POINTS = 2
const TURNSTILE_FALLBACK_DURATION = 600
const turnstileFallbackLimiter = new RateLimiterMemory({
    points: TURNSTILE_FALLBACK_POINTS,
    duration: TURNSTILE_FALLBACK_DURATION,
})

export async function checkTurnstileFallbackRateLimit(ip: string): Promise<boolean> {
    if (ip === "unknown") return false
    try {
        await turnstileFallbackLimiter.consume(ip)
        return true
    } catch {
        return false
    }
}

export const MAX_PENDING_ORDERS_PER_IP = config.maxPendingOrdersPerIp

/** AI 对话：每用户每小时最多 30 条消息 */
const AI_CHAT_POINTS = 30
const AI_CHAT_DURATION = 3600
const aiChatLimiter = new RateLimiterMemory({
    points: AI_CHAT_POINTS,
    duration: AI_CHAT_DURATION,
})

/**
 * Check AI chat rate limit (30 messages per user per hour).
 * Skipped in development.
 */
export async function checkAiChatRateLimit(userId: string): Promise<Response | null> {
    if (config.nodeEnv === "development") return null
    const key = `ai-chat:${userId}`
    try {
        await aiChatLimiter.consume(key)
        return null
    } catch {
        return new Response(
            JSON.stringify({ error: "AI 对话请求过于频繁，请稍后再试。" }),
            { status: 429, headers: { "Content-Type": "application/json" } },
        )
    }
}
