import { NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"
import { closeExpiredOrders } from "@/lib/close-expired-orders"
import { serviceUnavailable, unauthorized } from "@/lib/api-response"

/**
 * GET /api/cron/close-expired-orders
 * Secured by CRON_SECRET (Vercel Cron or external scheduler sends Authorization: Bearer CRON_SECRET).
 * When CRON_SECRET is not set, requests are rejected (503).
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization")
    const cronSecret = config.cronSecret
    if (!cronSecret) {
        return serviceUnavailable("Cron is not configured (CRON_SECRET required)")
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
        return unauthorized()
    }

    const result = await closeExpiredOrders()
    return NextResponse.json(result)
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
