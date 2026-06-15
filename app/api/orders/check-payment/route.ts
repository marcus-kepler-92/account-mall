import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { publicOrderLookupSchema } from "@/lib/validations/order"
import { verifyPassword } from "better-auth/crypto"
import { queryZpayOrder } from "@/lib/zpay"
import { completePendingOrder } from "@/lib/complete-pending-order"
import { checkOrderQueryRateLimit } from "@/lib/rate-limit"
import { invalidJsonBody, validationError, badRequest, internalServerError } from "@/lib/api-response"

/**
 * POST /api/orders/check-payment
 * Password-authenticated active payment check for the order lookup page.
 * If order is PENDING, actively queries Zpay; completes the order if confirmed paid.
 * Intended for "我已付款" self-service flow: user paid but closed Zpay before return_url redirect.
 */
export async function POST(request: NextRequest) {
    const limited = await checkOrderQueryRateLimit(request)
    if (limited) return limited

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = publicOrderLookupSchema.safeParse(body)
    if (!parsed.success) {
        return validationError()
    }

    const { orderNo, password } = parsed.data

    let order: {
        status: string
        passwordHash: string
    } | null

    try {
        order = await prisma.order.findUnique({
            where: { orderNo: orderNo.trim() },
            select: {
                status: true,
                passwordHash: true,
            },
        })
    } catch {
        return internalServerError()
    }

    if (!order) return badRequest("订单不存在或密码错误")

    const passwordOk = await verifyPassword({
        hash: order.passwordHash,
        password: password.trim(),
    }).catch(() => false)
    if (!passwordOk) return badRequest("订单不存在或密码错误")

    if (order.status !== "PENDING") {
        return NextResponse.json({ status: order.status })
    }

    const zpayResult = await queryZpayOrder(orderNo.trim()).catch(() => null)

    if (zpayResult?.paid) {
        await completePendingOrder(orderNo.trim()).catch(() => null)
        console.info("[check-payment] orderNo=%s result=completed", orderNo.trim())
        return NextResponse.json({ status: "COMPLETED" })
    }

    console.info("[check-payment] orderNo=%s result=pending", orderNo.trim())
    return NextResponse.json({ status: "PENDING" })
}

export const runtime = "nodejs"
