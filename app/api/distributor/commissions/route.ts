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

    const where: { distributorId: string; status?: "PENDING" | "SETTLED" | "WITHDRAWN" } = {
        distributorId: user.id,
    }
    if (status === "PENDING" || status === "SETTLED" || status === "WITHDRAWN") {
        where.status = status
    }

    const [commissions, total, settledSum, invitationRewardSum, paidSum, pendingSum] = await Promise.all([
        prisma.commission.findMany({
            where,
            include: {
                order: { select: { orderNo: true, amount: true, paidAt: true } },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.commission.count({ where }),
        prisma.commission.aggregate({
            where: { distributorId: user.id, status: "SETTLED" },
            _sum: { amount: true },
        }),
        prisma.invitationReward.aggregate({
            where: { inviterId: user.id, status: "SETTLED" },
            _sum: { amount: true },
        }),
        prisma.withdrawal.aggregate({
            where: { distributorId: user.id, status: "PAID" },
            _sum: { amount: true },
        }),
        prisma.withdrawal.aggregate({
            where: { distributorId: user.id, status: "PENDING" },
            _sum: { amount: true },
        }),
    ])

    const withdrawableBalance =
        Number(settledSum._sum.amount ?? 0) +
        Number(invitationRewardSum?._sum?.amount ?? 0) -
        Number(paidSum._sum.amount ?? 0) -
        Number(pendingSum._sum.amount ?? 0)

    return NextResponse.json({
        data: commissions.map((c) => ({
            id: c.id,
            orderId: c.orderId,
            orderNo: c.order.orderNo,
            amount: Number(c.amount),
            status: c.status,
            createdAt: c.createdAt,
            orderAmount: c.order ? Number(c.order.amount) : null,
            paidAt: c.order?.paidAt ?? null,
        })),
        meta: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
        },
        withdrawableBalance,
    })
}
