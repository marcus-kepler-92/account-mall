import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { publicOrderLookupByEmailSchema } from "@/lib/validations/order"
import { verifyPassword } from "better-auth/crypto"
import { checkOrderQueryRateLimit } from "@/lib/rate-limit"
import { invalidJsonBody, validationError, badRequest, internalServerError } from "@/lib/api-response"
import { parseAutoFetchCardContent } from "@/lib/auto-fetch-card"
import { createOrderSuccessToken } from "@/lib/order-success-token"
import { computePasswordFingerprint, backfillFingerprintIfMissing } from "@/lib/order-password-fingerprint"
import { config } from "@/lib/config"

/**
 * POST /api/orders/lookup-by-email
 *
 * Public: users query their orders by (email + password). To avoid the
 * pathological 42 s scrypt-storm — verifying scrypt against every order for the
 * email — we maintain a SHA-256 `passwordFingerprint` column indexed by
 * (email, passwordFingerprint, createdAt). The fast path issues a plain
 * indexed query (no scrypt) and only verifies the tiny matched set.
 *
 * Legacy orders predating the fingerprint column have `passwordFingerprint =
 * null` and are reachable via the bounded slow-path fallback (max 10 rows,
 * page 1 only).
 *
 * Response shapes:
 *   - Single match (total === 1): full single-order payload (unchanged).
 *   - Multiple matches: { orders, total, page, pageSize, totalPages }.
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
    const normalizedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

    // Pagination — defaults page=1, pageSize=10; pageSize clamped to [1, 50].
    const pageRaw = Number(parsed.data.page ?? 1)
    const pageSizeRaw = Number(parsed.data.pageSize ?? 10)
    const page = Math.max(1, Math.floor(pageRaw) || 1)
    const pageSize = Math.min(50, Math.max(1, Math.floor(pageSizeRaw) || 10))

    const orderSelect = {
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
    } as const

    try {
        const fingerprint = computePasswordFingerprint(normalizedEmail, trimmedPassword)

        // Fast path: indexed (email, passwordFingerprint, createdAt) lookup.
        // No scrypt needed to narrow the candidate set — typically returns 0
        // or 1–5 rows, even for buyers with many orders.
        const [fingerprintTotal, fingerprintOrders] = await Promise.all([
            prisma.order.count({
                where: { email: normalizedEmail, passwordFingerprint: fingerprint },
            }),
            prisma.order.findMany({
                where: { email: normalizedEmail, passwordFingerprint: fingerprint },
                select: orderSelect,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ])

        let matchingOrders = fingerprintOrders
        let total = fingerprintTotal

        // Belt-and-suspenders: even on the fast path, verify each candidate.
        // The fingerprint match is cheap and (cryptographically) accurate, but
        // scrypt is the authoritative check. With the pre-filter the set is
        // tiny so the verify cost is bounded.
        if (fingerprintOrders.length > 0) {
            const verifyResults = await Promise.allSettled(
                fingerprintOrders.map(async (o) => {
                    if (!o.passwordHash || typeof o.passwordHash !== "string") return null
                    try {
                        const ok = await verifyPassword({ hash: o.passwordHash, password: trimmedPassword })
                        return ok ? o : null
                    } catch {
                        return null
                    }
                }),
            )
            matchingOrders = verifyResults
                .filter(
                    (r): r is PromiseFulfilledResult<typeof fingerprintOrders[number]> =>
                        r.status === "fulfilled" && r.value !== null,
                )
                .map((r) => r.value!)
        }

        // Legacy fallback: orders predating the fingerprint column have
        // passwordFingerprint = null and never match the fast path. Only run
        // this on page=1 when the fast path returned zero; otherwise pagination
        // through old data would double-cost. Capped at LEGACY_MAX candidates.
        if (matchingOrders.length === 0 && page === 1) {
            const LEGACY_MAX = 10
            const legacy = await prisma.order.findMany({
                where: { email: normalizedEmail, passwordFingerprint: null },
                select: orderSelect,
                orderBy: { createdAt: "desc" },
                take: LEGACY_MAX,
            })
            const legacyResults = await Promise.allSettled(
                legacy.map(async (o) => {
                    if (!o.passwordHash || typeof o.passwordHash !== "string") return null
                    try {
                        const ok = await verifyPassword({ hash: o.passwordHash, password: trimmedPassword })
                        return ok ? o : null
                    } catch {
                        return null
                    }
                }),
            )
            matchingOrders = legacyResults
                .filter(
                    (r): r is PromiseFulfilledResult<typeof legacy[number]> =>
                        r.status === "fulfilled" && r.value !== null,
                )
                .map((r) => r.value!)
            total = matchingOrders.length

            // Lazy backfill: verified-but-legacy orders now get a fingerprint
            // so future lookups by this email + password hit the fast path.
            for (const o of matchingOrders) {
                backfillFingerprintIfMissing(o.id, normalizedEmail, trimmedPassword)
            }
        }

        if (matchingOrders.length === 0) {
            return badRequest("Order not found or password incorrect")
        }

        const totalPages = Math.max(1, Math.ceil(total / pageSize))

        // Single-order response (preserves legacy shape) only when total === 1.
        if (matchingOrders.length === 1 && total === 1) {
            const order = matchingOrders[0]
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
        }

        // Multiple orders — paginated list. Pagination is on the
        // fingerprint-matched set, which corresponds 1:1 with the buyer's own
        // orders (modulo verify mismatches, which are vanishingly rare).
        const orders = matchingOrders.map((order) => ({
            orderNo: order.orderNo,
            productName: order.productNameSnapshot ?? order.product?.name ?? "",
            createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
            status: order.status,
            quantity: order.quantity,
            amount: Number(order.amount),
        }))

        return NextResponse.json({
            orders,
            total,
            page,
            pageSize,
            totalPages,
        })
    } catch (err) {
        console.error("[lookup-by-email]", err)
        return internalServerError()
    }
}

export const runtime = "nodejs"
export const maxDuration = 60
