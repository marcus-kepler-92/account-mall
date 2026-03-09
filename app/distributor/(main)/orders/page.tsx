import { redirect } from "next/navigation"
import { getDistributorSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import {
    parseDistributorOrderFilters,
    type DistributorOrderFiltersInput,
} from "./orders-filters"
import { DistributorOrdersDataTable } from "./orders-data-table"
import type { DistributorOrderRow } from "./orders-columns"

export const dynamic = "force-dynamic"

export default async function DistributorOrdersPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; pageSize?: string; status?: string; search?: string }>
}) {
    const session = await getDistributorSession()
    if (!session) redirect("/distributor/login")

    const user = session.user as { id: string }
    const params = await searchParams
    const filters = parseDistributorOrderFilters(params as DistributorOrderFiltersInput)

    const where: { distributorId: string; status?: { in: ("PENDING" | "COMPLETED" | "CLOSED")[] }; orderNo?: { contains: string } } = {
        distributorId: user.id,
    }
    if (filters.statusList.length > 0) {
        where.status = { in: filters.statusList }
    }
    if (filters.search) {
        where.orderNo = { contains: filters.search.trim() }
    }

    const [orders, total, statusCounts] = await Promise.all([
        prisma.order.findMany({
            where,
            include: { product: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            skip: (filters.page - 1) * filters.pageSize,
            take: filters.pageSize,
        }),
        prisma.order.count({ where }),
        prisma.order.groupBy({
            by: ["status"],
            where: { distributorId: user.id },
            _count: { id: true },
        }),
    ])

    const orderStats = {
        PENDING: statusCounts.find((c) => c.status === "PENDING")?._count.id ?? 0,
        COMPLETED: statusCounts.find((c) => c.status === "COMPLETED")?._count.id ?? 0,
        CLOSED: statusCounts.find((c) => c.status === "CLOSED")?._count.id ?? 0,
    }

    const rows: DistributorOrderRow[] = orders.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        productName: o.productNameSnapshot ?? o.product.name,
        quantity: o.quantity,
        amount: Number(o.amount),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">我的订单</h2>
                <p className="text-muted-foreground">归属您的全部订单明细</p>
            </div>

            <DistributorOrdersDataTable
                data={rows}
                total={total}
                statusCounts={orderStats}
            />
        </div>
    )
}
