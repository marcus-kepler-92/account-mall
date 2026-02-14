import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { orderByEmailQuerySchema } from "@/lib/validations/order"
import { checkOrderQueryRateLimit } from "@/lib/rate-limit"

/**
 * GET /api/orders/by-email
 * Public: users can query their own orders by email.
 */
export async function GET(request: NextRequest) {
    const rateLimitRes = await checkOrderQueryRateLimit(request)
    if (rateLimitRes) return rateLimitRes

    const { searchParams } = new URL(request.url)

    const rawQuery = {
        email: searchParams.get("email") ?? "",
        page: searchParams.get("page") ?? undefined,
        pageSize: searchParams.get("pageSize") ?? undefined,
    }

    const parsed = orderByEmailQuerySchema.safeParse(rawQuery)
    if (!parsed.success) {
        // Public endpoint: avoid returning detailed validation structure.
        return NextResponse.json({ error: "Validation failed" }, { status: 400 })
    }

    const { email, page, pageSize } = parsed.data

    const where = {
        email: email.trim().toLowerCase(),
    }

    const [orders, total] = await Promise.all([
        prisma.order.findMany({
            where,
            include: {
                product: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.order.count({ where }),
    ])

    const data = orders.map((order) => ({
        orderNo: order.orderNo,
        createdAt: order.createdAt,
        status: order.status,
        productName: order.product.name,
        quantity: order.quantity,
        amount: Number(order.amount),
    }))

    return NextResponse.json({
        data,
        meta: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
        },
    })
}

export const runtime = "nodejs"

