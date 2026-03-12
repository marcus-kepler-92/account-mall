import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"

export async function GET() {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const distributors = await prisma.user.findMany({
        where: { role: "DISTRIBUTOR" },
        select: {
            id: true,
            email: true,
            name: true,
            distributorCode: true,
            discountCodeEnabled: true,
            discountPercent: true,
            disabledAt: true,
            createdAt: true,
            _count: {
                select: { ordersAsDistributor: true },
            },
        },
        orderBy: { createdAt: "desc" },
    })

    const withStats = await Promise.all(
        distributors.map(async (d) => {
            const [completedOrders, totalCommission, settledSum, invitationRewardSum, paidWithdrawals, pendingWithdrawals] =
                await Promise.all([
                    prisma.order.count({
                        where: { distributorId: d.id, status: "COMPLETED" },
                    }),
                    prisma.commission.aggregate({
                        where: { distributorId: d.id },
                        _sum: { amount: true },
                    }),
                    prisma.commission.aggregate({
                        where: { distributorId: d.id, status: "SETTLED" },
                        _sum: { amount: true },
                    }),
                    prisma.invitationReward.aggregate({
                        where: { inviterId: d.id, status: "SETTLED" },
                        _sum: { amount: true },
                    }),
                    prisma.withdrawal.aggregate({
                        where: { distributorId: d.id, status: "PAID" },
                        _sum: { amount: true },
                    }),
                    prisma.withdrawal.aggregate({
                        where: { distributorId: d.id, status: "PENDING" },
                        _sum: { amount: true },
                    }),
                ])
            const withdrawable =
                Number(settledSum._sum.amount ?? 0) +
                Number(invitationRewardSum?._sum?.amount ?? 0) -
                Number(paidWithdrawals._sum.amount ?? 0) -
                Number(pendingWithdrawals._sum.amount ?? 0)
            return {
                id: d.id,
                email: d.email,
                name: d.name,
                distributorCode: d.distributorCode,
                discountCodeEnabled: d.discountCodeEnabled,
                discountPercent: d.discountPercent != null ? Number(d.discountPercent) : null,
                disabledAt: d.disabledAt,
                createdAt: d.createdAt,
                orderCount: d._count.ordersAsDistributor,
                completedOrderCount: completedOrders,
                totalCommission: Number(totalCommission._sum.amount ?? 0),
                withdrawableBalance: withdrawable,
            }
        })
    )

    return NextResponse.json(withStats)
}
