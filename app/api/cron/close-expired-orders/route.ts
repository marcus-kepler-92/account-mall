import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"

/** Grace period (ms) after timeout before closing orders, to allow Alipay notify to arrive first. */
const PENDING_ORDER_CLOSE_GRACE_MS = 2 * 60 * 1000 // 2 minutes

/**
 * GET /api/cron/close-expired-orders
 * Vercel Cron: close PENDING orders older than PENDING_ORDER_TIMEOUT_MS + grace and release reserved cards.
 * Secured by CRON_SECRET (Vercel sends Authorization: Bearer CRON_SECRET).
 * When CRON_SECRET is not set, requests are rejected (503).
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization")
    const cronSecret = config.cronSecret
    if (!cronSecret) {
        return NextResponse.json(
            { error: "Cron is not configured (CRON_SECRET required)" },
            { status: 503 },
        )
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const closeBeforeMs = config.pendingOrderTimeoutMs + PENDING_ORDER_CLOSE_GRACE_MS
    const before = new Date(Date.now() - closeBeforeMs)

    const expired = await prisma.order.findMany({
        where: {
            status: "PENDING",
            createdAt: { lt: before },
        },
        select: { id: true },
    })

    if (expired.length === 0) {
        return NextResponse.json({ closed: 0 })
    }

    let closed = 0
    for (const order of expired) {
        try {
            await prisma.$transaction(async (tx) => {
                await tx.order.update({
                    where: { id: order.id },
                    data: { status: "CLOSED" },
                })
                await tx.card.updateMany({
                    where: { orderId: order.id, status: "RESERVED" },
                    data: { status: "UNSOLD", orderId: null },
                })
            })
            closed++
        } catch (err) {
            console.error("[cron/close-expired-orders] Failed to close order", order.id, err)
        }
    }

    return NextResponse.json({ closed, total: expired.length })
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
