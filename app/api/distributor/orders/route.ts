import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getDistributorSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"

export async function GET(request: NextRequest) {
    const session = await getDistributorSession()
    if (!session) return unauthorized()

    const user = session.user as { id: string }
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)))
    const status = searchParams.get("status")

    const where: { distributorId: string; status?: "PENDING" | "COMPLETED" | "CLOSED" } = {
        distributorId: user.id,
    }
    if (status === "PENDING" || status === "COMPLETED" || status === "CLOSED") {
        where.status = status
    }

    const [orders, total] = await Promise.all([
        prisma.order.findMany({
            where,
            include: {
                product: { select: { id: true, name: true, slug: true, price: true } },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.order.count({ where }),
    ])

    return NextResponse.json({
        data: orders.map((o) => ({
            id: o.id,
            orderNo: o.orderNo,
            product: o.product,
            quantity: o.quantity,
            amount: Number(o.amount),
            status: o.status,
            paidAt: o.paidAt,
            createdAt: o.createdAt,
        })),
        meta: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
        },
    })
}
