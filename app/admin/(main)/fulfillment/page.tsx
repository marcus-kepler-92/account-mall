import { OrderStatus, ProductType, type Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/app/admin/components"
import {
    parseFulfillmentFilters,
    type FulfillmentFiltersInput,
} from "./fulfillment-filters"
import { FulfillmentKpis } from "./fulfillment-kpis"
import { FulfillmentDataTable } from "./fulfillment-data-table"
import type { FulfillmentRow } from "./fulfillment-columns"

export const dynamic = "force-dynamic"

type SearchParams = Promise<{
    page?: string
    pageSize?: string
    status?: string
    search?: string
    dunnedOnly?: string
}>

function startOfToday(): Date {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
}

export default async function AdminFulfillmentPage({
    searchParams,
}: {
    searchParams: SearchParams
}) {
    const raw = await searchParams
    const filters = parseFulfillmentFilters(raw as FulfillmentFiltersInput)
    const search = (raw.search ?? "").trim()

    // Base scope: MANUAL products only — this center never shows NORMAL/AUTO_FETCH.
    const manualScope: Prisma.OrderWhereInput = {
        product: { is: { productType: ProductType.MANUAL } },
    }

    const where: Prisma.OrderWhereInput = { ...manualScope }
    if (filters.statusList.length > 0) {
        where.status = { in: filters.statusList }
    }
    if (filters.dunnedOnly) {
        where.dunCount = { gt: 0 }
    }
    if (search) {
        where.OR = [
            { email: { contains: search, mode: "insensitive" } },
            { orderNo: { contains: search, mode: "insensitive" } },
        ]
    }

    const today = startOfToday()

    const [orders, total, awaitingCount, processingCount, dunnedCount, completedTodayCount] =
        await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    product: { select: { id: true, name: true } },
                },
                orderBy: [{ dunCount: "desc" }, { createdAt: "asc" }],
                skip: (filters.page - 1) * filters.pageSize,
                take: filters.pageSize,
            }),
            prisma.order.count({ where }),
            prisma.order.count({
                where: { ...manualScope, status: OrderStatus.AWAITING_FULFILLMENT },
            }),
            prisma.order.count({
                where: { ...manualScope, status: OrderStatus.PROCESSING },
            }),
            prisma.order.count({
                where: {
                    ...manualScope,
                    status: { in: [OrderStatus.AWAITING_FULFILLMENT, OrderStatus.PROCESSING] },
                    dunCount: { gt: 0 },
                },
            }),
            // "今日已发" — count COMPLETED MANUAL orders whose fulfillment record was
            // created today. Joining via fulfillment guarantees we count the act of
            // fulfilling (not e.g. a status update via cron).
            prisma.order.count({
                where: {
                    ...manualScope,
                    status: OrderStatus.COMPLETED,
                    fulfillment: { is: { fulfilledAt: { gte: today } } },
                },
            }),
        ])

    const rows: FulfillmentRow[] = orders.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        email: o.email ?? "",
        productName: o.productNameSnapshot ?? o.product.name,
        variantName: o.variantNameSnapshot,
        quantity: o.quantity,
        amount: Number(o.amount),
        status: o.status as FulfillmentRow["status"],
        dunCount: o.dunCount,
        lastDunAt: o.lastDunAt ? o.lastDunAt.toISOString() : null,
        createdAt: o.createdAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            <PageHeader
                title="人工发货"
                description="集中处理需要手工填写发货内容的订单"
            />

            <FulfillmentKpis
                counts={{
                    awaiting: awaitingCount,
                    processing: processingCount,
                    dunned: dunnedCount,
                    completedToday: completedTodayCount,
                }}
                status={filters.status}
                dunnedOnly={filters.dunnedOnly}
            />

            <FulfillmentDataTable data={rows} total={total} />
        </div>
    )
}
