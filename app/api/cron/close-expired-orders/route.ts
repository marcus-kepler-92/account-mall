import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const PENDING_ORDER_TIMEOUT_MS = Number(process.env.PENDING_ORDER_TIMEOUT_MS) || 15 * 60 * 1000 // 15 min

/**
 * GET /api/cron/close-expired-orders
 * Vercel Cron: close PENDING orders older than PENDING_ORDER_TIMEOUT_MS and release reserved cards.
 * Secured by CRON_SECRET (Vercel sends Authorization: Bearer CRON_SECRET).
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const before = new Date(Date.now() - PENDING_ORDER_TIMEOUT_MS)

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
