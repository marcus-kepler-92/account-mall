import { prisma } from "@/lib/prisma"
import { parseDetailQuery } from "./query"
import { sumOrderCommission } from "./data"
import { DetailSortableDataTable } from "./detail-sortable-data-table"
import {
    distributorOrdersColumns,
    orderStatusOptions,
    type DistributorOrderRow,
} from "./orders-columns"

const ORDER_STATUSES = [
    "PENDING",
    "AWAITING_FULFILLMENT",
    "PROCESSING",
    "COMPLETED",
    "CLOSED",
    "REFUNDED",
]

export async function OrdersTab({
    distributorId,
    searchParams,
}: {
    distributorId: string
    searchParams: Record<string, string | undefined>
}) {
    const { page, pageSize, orderBy, statusList, search } = parseDetailQuery(
        searchParams,
        ORDER_STATUSES,
    )

    const where: Record<string, unknown> = { distributorId }
    if (statusList.length > 0) where.status = { in: statusList }
    if (search) where.orderNo = { contains: search }

    const [orders, total] = await Promise.all([
        prisma.order.findMany({
            where,
            include: {
                product: { select: { name: true } },
                // Only this distributor's own commissions on the order (level-1),
                // excluding cancelled ones — that is the per-order earning shown.
                commissions: {
                    where: { distributorId, status: { not: "CANCELLED" } },
                    select: { amount: true, status: true },
                },
            },
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.order.count({ where }),
    ])

    const data: DistributorOrderRow[] = orders.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        productName: o.productNameSnapshot ?? o.product.name,
        amount: Number(o.amount),
        commissionAmount: sumOrderCommission(
            o.commissions.map((c) => ({ amount: Number(c.amount), status: c.status })),
        ),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
    }))

    return (
        <DetailSortableDataTable
            data={data}
            total={total}
            columns={distributorOrdersColumns}
            statusOptions={orderStatusOptions}
            searchPlaceholder="搜索订单号..."
            emptyMessage="暂无订单"
        />
    )
}
