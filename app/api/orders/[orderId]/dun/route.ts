import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verifyPassword } from "better-auth/crypto"
import { prisma } from "@/lib/prisma"
import { sendWecomNotification } from "@/lib/wecom-notify"
import { getSiteSettings } from "@/lib/site-settings"
import { checkOrderQueryRateLimit } from "@/lib/rate-limit"
import {
    unauthorized,
    conflict,
    tooManyRequests,
    invalidJsonBody,
    validationError,
} from "@/lib/api-response"

const bodySchema = z.object({
    orderNo: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(1),
})

/**
 * POST /api/orders/[orderId]/dun
 *
 * Public buyer-facing endpoint — buyer 催发货 (nudge admin to ship).
 *
 * Auth model: lookup credential (orderNo + email + password). No session.
 * - Composite mismatch (id + orderNo + email) → 401 (same as wrong password
 *   to avoid leaking which field is wrong to an attacker).
 * - Allowed only when order is AWAITING_FULFILLMENT or PROCESSING.
 * - Guarded by two cooldowns from SiteSettings:
 *     - dunMinAgeMinutes:  minimum age of the order before first dun
 *     - dunCooldownMinutes: gap between consecutive duns
 * - Side effects: increment `dunCount`, set `lastDunAt`, fire WeCom push
 *   (fire-and-forget — admin notification must never block buyer response).
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
    // IP-level throttle MUST run before any other work (bcrypt verifyPassword
    // is expensive — guard brute-force on a known orderNo+email pair).
    const rateLimitRes = await checkOrderQueryRateLimit(request)
    if (rateLimitRes) return rateLimitRes

    const { orderId } = await ctx.params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors)

    const order = await prisma.order.findFirst({
        where: {
            id: orderId,
            orderNo: parsed.data.orderNo,
            email: parsed.data.email,
        },
    })
    // Composite mismatch → 401 (not 404) to avoid leaking which field is wrong.
    if (!order) return unauthorized()

    const ok = await verifyPassword({
        hash: order.passwordHash,
        password: parsed.data.password,
    }).catch(() => false)
    if (!ok) return unauthorized()

    if (order.status !== "AWAITING_FULFILLMENT" && order.status !== "PROCESSING") {
        return conflict("当前订单状态不允许催发货")
    }

    const settings = await getSiteSettings()
    const ageMs = Date.now() - order.createdAt.getTime()
    if (ageMs < settings.dunMinAgeMinutes * 60_000) {
        return tooManyRequests("订单刚创建，请稍后再催")
    }
    if (order.lastDunAt) {
        const elapsed = Date.now() - order.lastDunAt.getTime()
        const cooldownMs = settings.dunCooldownMinutes * 60_000
        if (elapsed < cooldownMs) {
            const remaining = Math.ceil((cooldownMs - elapsed) / 1000)
            return tooManyRequests(`催发货冷却中，请 ${remaining} 秒后再试`)
        }
    }

    const now = new Date()
    // Capture the post-update dunCount so concurrent dun requests (both passing
    // the cooldown floor simultaneously) cannot both report a stale `+1` value.
    // `{ increment: 1 }` is atomic at the DB level; selecting the returned value
    // gives us the true new count for the WeCom payload.
    const updated = await prisma.order.update({
        where: { id: orderId },
        data: {
            dunCount: { increment: 1 },
            lastDunAt: now,
        },
        select: { dunCount: true },
    })

    // Fire-and-forget: admin push must never block buyer response.
    sendWecomNotification("order.dun", {
        id: order.id,
        orderNo: order.orderNo,
        amount: order.amount,
        email: order.email,
        status: order.status,
        productNameSnapshot: order.productNameSnapshot,
        variantNameSnapshot: order.variantNameSnapshot,
        dunCount: updated.dunCount,
    }).catch((e) => console.error("[wecom-notify]", e))

    return NextResponse.json({
        ok: true,
        cooldownRemainingSeconds: settings.dunCooldownMinutes * 60,
    })
}

export const runtime = "nodejs"
