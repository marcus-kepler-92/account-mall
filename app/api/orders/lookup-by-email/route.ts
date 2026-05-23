import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { publicOrderLookupByEmailSchema } from "@/lib/validations/order"
import { verifyPassword } from "better-auth/crypto"
import { checkOrderQueryRateLimit } from "@/lib/rate-limit"
import { invalidJsonBody, validationError, badRequest, internalServerError } from "@/lib/api-response"
import { parseAutoFetchCardContent } from "@/lib/auto-fetch-card"
import { createOrderSuccessToken } from "@/lib/order-success-token"
import { config } from "@/lib/config"

/**
 * POST /api/orders/lookup-by-email
 * Public: users can query order details and cards by email + password.
 * Returns a list of matching orders if multiple exist, or a single order with cards if only one matches.
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

    const parsed = publicOrderLookupByEmailSchema.safeParse(body)
    if (!parsed.success) {
        // Public endpoint: avoid exposing detailed validation errors.
        return validationError(undefined)
    }

    const { email, password } = parsed.data

    try {
        const MAX_ORDERS_TO_CHECK = 30
        const allOrders = await prisma.order.findMany({
            where: {
                email: email.trim().toLowerCase(),
            },
            select: {
                id: true,
                orderNo: true,
                email: true,
                passwordHash: true,
                status: true,
                createdAt: true,
                expiresAt: true,
                quantity: true,
                amount: true,
                productNameSnapshot: true,
                variantNameSnapshot: true,
                dunCount: true,
                lastDunAt: true,
                product: {
                    select: {
                        name: true,
                        productType: true,
                        allowAccountSwitch: true,
                        accountSwitchLimit: true,
                        cardTemplates: {
                            orderBy: { sortOrder: "asc" as const },
                            select: { template: true },
                        },
                    },
                },
                cards: {
                    select: {
                        id: true,
                        content: true,
                        status: true,
                    },
                },
                fulfillment: {
                    select: { content: true },
                },
                switchAccountCount: true,
            },
            orderBy: {
                createdAt: "desc",
            },
            take: MAX_ORDERS_TO_CHECK,
        })

        if (allOrders.length === 0) {
            return badRequest("Order not found or password incorrect")
        }

        const verifyResults = await Promise.allSettled(
            allOrders.map(async (order) => {
                if (!order.passwordHash || typeof order.passwordHash !== "string") return null
                try {
                    const ok = await verifyPassword({ hash: order.passwordHash, password: password.trim() })
                    return ok ? order : null
                } catch {
                    return null
                }
            }),
        )
        const matchingOrders = verifyResults
            .filter((r): r is PromiseFulfilledResult<typeof allOrders[0]> =>
                r.status === "fulfilled" && r.value !== null,
            )
            .map((r) => r.value)

        if (matchingOrders.length === 0) {
            return badRequest("Order not found or password incorrect")
        }

        const result = matchingOrders.length === 1
            ? { type: "single" as const, data: matchingOrders[0] }
            : { type: "multiple" as const, data: matchingOrders }

if (result.type === "single") {
            const order = result.data
            if (!order.product) {
                throw new Error("LOOKUP_FAILED")
            }

            // For PENDING orders, return order info without cards
            if (order.status === "PENDING") {
                const elapsed = Date.now() - new Date(order.createdAt).getTime()
                const canPay = elapsed < config.pendingOrderTimeoutMs
                const expiresAt = new Date(
                    new Date(order.createdAt).getTime() + config.pendingOrderTimeoutMs,
                ).toISOString()
                return NextResponse.json({
                    orderNo: order.orderNo,
                    productName: order.productNameSnapshot ?? order.product.name,
                    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
                    status: order.status,
                    amount: Number(order.amount),
                    cards: [],
                    isPending: true,
                    canPay,
                    expiresAt,
                })
            }

            // MANUAL intermediate states (paid but not yet fulfilled): no cards, no fulfillment content,
            // surface variantName + dun stats so the buyer page can render the waiting timeline.
            if (
                order.status === "AWAITING_FULFILLMENT" ||
                order.status === "PROCESSING"
            ) {
                return NextResponse.json({
                    orderNo: order.orderNo,
                    productName: order.productNameSnapshot ?? order.product.name,
                    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
                    status: order.status,
                    amount: Number(order.amount),
                    productType: "MANUAL" as const,
                    cards: [],
                    fulfillment: null,
                    variantName: order.variantNameSnapshot,
                    dunCount: order.dunCount,
                    lastDunAt: order.lastDunAt
                        ? (order.lastDunAt instanceof Date
                              ? order.lastDunAt.toISOString()
                              : order.lastDunAt)
                        : null,
                })
            }

            // For COMPLETED/CLOSED orders, return cards (NORMAL/AUTO_FETCH) or fulfillment (MANUAL).
            const isManual = order.product?.productType === "MANUAL"
            const cards = isManual
                ? []
                : order.cards
                      .filter((card) => card.status === "SOLD" || card.status === "RESERVED")
                      .map((card) => {
                          const payload = parseAutoFetchCardContent(card.content)
                          if (payload) {
                              return { content: card.content, ...payload }
                          }
                          return { content: card.content }
                      })

            const isAutoFetch = order.product?.productType === "AUTO_FETCH"
            const successToken = createOrderSuccessToken(order.orderNo)
            const switchLimit = order.product?.accountSwitchLimit ?? 1
            const remainingSwitches = Math.max(0, switchLimit - order.switchAccountCount)
            const canSwitch =
                isAutoFetch &&
                order.status === "COMPLETED" &&
                (order.product?.allowAccountSwitch ?? true) &&
                remainingSwitches > 0 &&
                (!order.expiresAt || new Date(order.expiresAt) > new Date())
            return NextResponse.json({
                orderNo: order.orderNo,
                productName: order.productNameSnapshot ?? order.product?.name ?? "",
                createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
                status: order.status,
                amount: Number(order.amount),
                productType: order.product?.productType ?? "NORMAL",
                cards,
                fulfillment: isManual ? (order.fulfillment ?? null) : null,
                variantName: order.variantNameSnapshot,
                dunCount: order.dunCount,
                lastDunAt: order.lastDunAt
                    ? (order.lastDunAt instanceof Date
                          ? order.lastDunAt.toISOString()
                          : order.lastDunAt)
                    : null,
                cardTemplates: order.product?.cardTemplates ?? [],
                ...(successToken && { successToken }),
                ...(isAutoFetch && { isAutoFetch: true }),
                ...(isAutoFetch && order.expiresAt && { contentExpiresAt: new Date(order.expiresAt).toISOString() }),
                ...(isAutoFetch && { canSwitch }),
                ...(isAutoFetch && { remainingSwitches }),
            })
        } else {
            // Multiple orders - return list
            const orders = result.data.map((order) => ({
                orderNo: order.orderNo,
                productName: order.productNameSnapshot ?? order.product?.name ?? "",
                createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
                status: order.status,
                quantity: order.quantity,
                amount: Number(order.amount),
            }))

            return NextResponse.json({
                orders,
            })
        }
    } catch {
        return internalServerError()
    }
}

export const runtime = "nodejs"
export const maxDuration = 60
