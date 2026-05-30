import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { assertTransition, InvalidTransitionError } from "@/lib/order-state-machine"
import { createOrderCommissions } from "@/lib/calculate-order-commission"
import { checkAndIssueMilestoneBonuses } from "@/lib/domains/distributors"
import { sendOrderCompletionEmail } from "@/lib/order-completion-email"
import {
    unauthorized,
    conflict,
    notFound,
    invalidJsonBody,
    validationError,
    internalServerError,
} from "@/lib/api-response"

const bodySchema = z.object({
    content: z.string().min(1, "发货内容必填").max(5000, "发货内容最长 5000 字符"),
})

export async function POST(request: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors)

    const { orderId } = await ctx.params

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { product: { select: { productType: true, commissionMode: true, commissionValue: true } } },
    })
    if (!order) return notFound("Order not found")
    if (!order.product) return internalServerError()

    try {
        assertTransition(order.status, "COMPLETED", order.product.productType)
    } catch (err) {
        if (err instanceof InvalidTransitionError) return conflict(err.message)
        throw err
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.orderFulfillment.create({
                data: {
                    orderId,
                    content: parsed.data.content,
                    fulfilledBy: session.user.id,
                },
            })
            await tx.order.update({
                where: { id: orderId },
                data: { status: "COMPLETED" },
            })
            if (order.distributorId) {
                await createOrderCommissions(tx, {
                    orderId,
                    distributorId: order.distributorId,
                    orderEmail: order.email ?? "",
                    orderAmount: order.amount,
                    discountPercentApplied: order.discountPercentApplied,
                    paidAt: order.paidAt ?? new Date(),
                    commissionMode: order.product.commissionMode,
                    commissionValue: order.product.commissionValue,
                    quantity: order.quantity,
                })
                await checkAndIssueMilestoneBonuses(tx, order.distributorId)
            }
        })
    } catch (err) {
        if (err && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "P2002") {
            return conflict("订单已被发货，无法重复")
        }
        console.error("[fulfill-order]", err)
        return internalServerError()
    }

    // Fire-and-forget: must run AFTER the transaction commits, never inside it.
    sendOrderCompletionEmail(orderId).catch((e) => console.error("[order-completion-email]", e))

    return NextResponse.json({ ok: true })
}
