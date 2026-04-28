import { NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"
import { restoreAvailableAccounts } from "@/lib/restore-available-accounts"
import { serviceUnavailable, unauthorized } from "@/lib/api-response"

/**
 * GET /api/cron/restore-available-accounts
 * For each AUTO_FETCH product, scrapes the source and removes blacklisted accounts
 * that have reappeared upstream (indicating they've been refreshed and are usable again).
 * Secured by CRON_SECRET (Vercel Cron sends Authorization: Bearer CRON_SECRET).
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

    const result = await restoreAvailableAccounts()
    return NextResponse.json(result)
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
