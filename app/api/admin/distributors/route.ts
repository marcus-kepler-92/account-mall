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
            const [completedOrders, totalCommission, paidWithdrawals] = await Promise.all([
                prisma.order.count({
                    where: { distributorId: d.id, status: "COMPLETED" },
                }),
                prisma.commission.aggregate({
                    where: { distributorId: d.id },
                    _sum: { amount: true },
                }),
                prisma.withdrawal.aggregate({
                    where: { distributorId: d.id, status: "PAID" },
                    _sum: { amount: true },
                }),
            ])
            const settled = await prisma.commission.aggregate({
                where: { distributorId: d.id, status: "SETTLED" },
                _sum: { amount: true },
            })
            const withdrawable = Number(settled._sum.amount ?? 0) - Number(paidWithdrawals._sum.amount ?? 0)
            return {
                id: d.id,
                email: d.email,
                name: d.name,
                distributorCode: d.distributorCode,
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
