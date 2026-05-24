import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { publicOrderLookupByEmailSchema } from "@/lib/validations/order"
import { checkOrderQueryRateLimit } from "@/lib/rate-limit"
import { invalidJsonBody, validationError } from "@/lib/api-response"

/**
 * POST /api/orders/lookup-by-email
 *
 * Public: returns the buyer's order LIST (metadata only) for a given email.
 * No password required, no scrypt verify, no card content. To open the detail
 * of any single row the buyer must call POST /api/orders/lookup with that
 * order's password — sensitive fields (cards / fulfillment text / passwordHash
 * / clientIp / fingerprintHash / promoCode / distributorId / exitDiscountMeta)
 * are never exposed by this endpoint.
 *
 * Enumeration defense: an empty / unknown email returns 200 + empty list with
 * the same shape as a hit. Combined with the IP-level rate limit on
 * checkOrderQueryRateLimit, attackers cannot mass-enumerate registered emails.
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

    const { email } = parsed.data
    const normalizedEmail = email.trim().toLowerCase()
    const page = Math.max(1, Math.floor(parsed.data.page ?? 1) || 1)
    const pageSize = Math.min(50, Math.max(1, Math.floor(parsed.data.pageSize ?? 10) || 10))

    const where = { email: normalizedEmail }
    const [total, orders] = await Promise.all([
        prisma.order.count({ where }),
        prisma.order.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
            // List-level metadata ONLY. Do NOT expose passwordHash, cards,
            // fulfillment, clientIp, fingerprintHash, sourceUrl, promoCode,
            // distributorId, exitDiscountMeta — sensitive content requires the
            // per-order password (lookup endpoint).
            select: {
                orderNo: true,
                productNameSnapshot: true,
                variantNameSnapshot: true,
                status: true,
                amount: true,
                quantity: true,
                createdAt: true,
                // For MANUAL intermediate-state UI hint on the list row only.
                product: { select: { productType: true } },
            },
        }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return NextResponse.json({
        orders: orders.map((o) => ({
            orderNo: o.orderNo,
            productName: o.productNameSnapshot ?? "",
            variantName: o.variantNameSnapshot ?? null,
            status: o.status,
            amount: Number(o.amount),
            quantity: o.quantity,
            createdAt: o.createdAt.toISOString(),
            productType: o.product?.productType ?? "NORMAL",
        })),
        total,
        page,
        pageSize,
        totalPages,
    })
}

export const runtime = "nodejs"
