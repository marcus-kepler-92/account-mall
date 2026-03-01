import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { publicOrderLookupSchema, orderStatusSchema } from "@/lib/validations/order"
import type { z } from "zod"
import { verifyPassword } from "better-auth/crypto"
import { createOrderSuccessToken } from "@/lib/order-success-token"
import { checkOrderQueryRateLimit } from "@/lib/rate-limit"
import { invalidJsonBody, validationError, badRequest, internalServerError } from "@/lib/api-response"
import { config } from "@/lib/config"
import { parseFreeSharedCardContent } from "@/lib/free-shared-card"

type LookupBody = z.infer<typeof publicOrderLookupSchema>
type OrderStatus = z.infer<typeof orderStatusSchema>

type TransactionClient = Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

interface LookupResponseBase {
    orderNo: string
    productName: string
    createdAt: Date
    status: OrderStatus
    amount: number
}

interface LookupResponsePending extends LookupResponseBase {
    cards: []
    isPending: true
    /** 未超时且可继续支付时为 true */
    canPay: boolean
    /** 支付截止时间（ISO），便于前端展示「请在 xx 前完成支付」 */
    expiresAt?: string
}

/** 卡密：普通为 content；免费共享为 content(JSON) + account/password/region/lastCheckedAt/installStatus */
interface LookupResponseCompleted extends LookupResponseBase {
    cards: Array<
        | { content: string }
        | {
              content: string
              account: string
              password: string
              region: string
              lastCheckedAt?: string
              installStatus?: string
          }
    >
    successToken?: string
}

/**
 * POST /api/orders/lookup
 * Public: users can query order details and cards by orderNo + password.
 */
export async function POST(request: NextRequest) {
    const rateLimitRes = await checkOrderQueryRateLimit(request)
    if (rateLimitRes) return rateLimitRes

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = publicOrderLookupSchema.safeParse(body)
    if (!parsed.success) {
        // Public endpoint: avoid exposing detailed validation errors.
        return validationError()
    }

    const { orderNo, password }: LookupBody = parsed.data

    try {
        const order = await prisma.$transaction(async (tx: TransactionClient) => {
            const existing = await tx.order.findUnique({
                where: { orderNo: orderNo.trim() },
                include: {
                    product: {
                        select: {
                            name: true,
                        },
                    },
                    cards: {
                        select: {
                            id: true,
                            content: true,
                            status: true,
                        },
                    },
                },
            })

            if (!existing) {
                throw new Error("LOOKUP_FAILED")
            }

            // verifyPassword signature: verifyPassword({ hash, password })
            const passwordOk = await verifyPassword({ hash: existing.passwordHash, password: password.trim() })
            if (!passwordOk) {
                throw new Error("LOOKUP_FAILED")
            }

            return existing
        })

        // For PENDING orders, return order info without cards + canPay/expiresAt
        if (order.status === "PENDING") {
            const elapsed = Date.now() - order.createdAt.getTime()
            const canPay = elapsed < config.pendingOrderTimeoutMs
            const expiresAt = new Date(order.createdAt.getTime() + config.pendingOrderTimeoutMs).toISOString()
            const payload: LookupResponsePending = {
                orderNo: order.orderNo,
                productName: order.product.name,
                createdAt: order.createdAt,
                status: order.status,
                amount: Number(order.amount),
                cards: [],
                isPending: true,
                canPay,
                expiresAt,
            }
            return NextResponse.json(payload)
        }

        // For COMPLETED/CLOSED orders, return cards and optional successToken for redirect to success page.
        // Free orders (FREE_SHARED or amount 0) must not get successToken so user stays on lookup page.
        type CardRow = { content: string; status: string }
        const cards = (order.cards as CardRow[])
            .filter((card: CardRow) => card.status === "SOLD" || card.status === "RESERVED")
            .map((card: CardRow) => {
                const payload = parseFreeSharedCardContent(card.content)
                if (payload) {
                    return { content: card.content, ...payload }
                }
                return { content: card.content }
            })

        // Free orders are created with amount 0; do not issue successToken so user stays on lookup page
        const isFreeOrder = Number(order.amount) === 0
        const successToken = isFreeOrder ? undefined : createOrderSuccessToken(order.orderNo)
        const payload: LookupResponseCompleted = {
            orderNo: order.orderNo,
            productName: order.product.name,
            createdAt: order.createdAt,
            status: order.status,
            amount: Number(order.amount),
            cards,
            ...(successToken && { successToken }),
        }
        return NextResponse.json(payload)
    } catch (error) {
        if (error instanceof Error && error.message === "LOOKUP_FAILED") {
            return badRequest("Order not found or password incorrect")
        }

        return internalServerError()
    }
}

export const runtime = "nodejs"

