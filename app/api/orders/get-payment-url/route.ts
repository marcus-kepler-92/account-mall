import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { publicOrderLookupSchema } from "@/lib/validations/order"
import type { z } from "zod"
import { verifyPassword } from "better-auth/crypto"
import { config } from "@/lib/config"
import { getPaymentUrlForOrder, type ClientType } from "@/lib/get-payment-url"
import { invalidJsonBody, validationError, badRequest, internalServerError, serviceUnavailable } from "@/lib/api-response"

type LookupBody = z.infer<typeof publicOrderLookupSchema>

type TransactionClient = Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

/**
 * POST /api/orders/get-payment-url
 * 带密码校验的「继续支付」：仅当 orderNo+密码正确、订单 PENDING 且未超时时返回支付链接。
 */
export async function POST(request: NextRequest) {
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

    const { orderNo, password }: LookupBody = parsed.data
    const raw = body && typeof body === "object" && "clientType" in body
        ? (body as { clientType?: string })
        : {}
    const clientType: ClientType = raw.clientType === "wap" ? "wap" : "pc"

    try {
        const order = await prisma.$transaction(async (tx: TransactionClient) => {
            const existing = await tx.order.findUnique({
                where: { orderNo: orderNo.trim() },
                include: {
                    product: { select: { name: true } },
                },
            })
            if (!existing) throw new Error("LOOKUP_FAILED")
            const passwordOk = await verifyPassword({ hash: existing.passwordHash, password: password.trim() })
            if (!passwordOk) throw new Error("LOOKUP_FAILED")
            return existing
        })

        if (order.status !== "PENDING") {
            return badRequest("无法继续支付")
        }
        const elapsed = Date.now() - order.createdAt.getTime()
        if (elapsed >= config.pendingOrderTimeoutMs) {
            return badRequest("无法继续支付")
        }

        const totalAmount = Number(order.amount).toFixed(2)
        const subject = order.productNameSnapshot ?? order.product?.name ?? `订单 ${order.orderNo}`
        const paymentUrl = getPaymentUrlForOrder({
            orderNo: order.orderNo,
            totalAmount,
            subject,
            clientType,
        })

        if (!paymentUrl) {
            return serviceUnavailable("支付暂不可用，请稍后重试")
        }

        return NextResponse.json({ paymentUrl })
    } catch (error) {
        if (error instanceof Error && error.message === "LOOKUP_FAILED") {
            return badRequest("订单不存在或密码错误")
        }
        return internalServerError()
    }
}

export const runtime = "nodejs"
