import { NextRequest, NextResponse } from "next/server"
import { config } from "@/lib/config"
import { prisma } from "@/lib/prisma"
import { serviceUnavailable, unauthorized } from "@/lib/api-response"

/**
 * GET /api/cron/agent-cleanup
 * Deletes expired AgentSession rows (cascades messages + lead).
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

    const deleted = await prisma.agentSession.deleteMany({
        where: { expiresAt: { lt: new Date() } },
    })
    return NextResponse.json({ deleted: deleted.count })
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
