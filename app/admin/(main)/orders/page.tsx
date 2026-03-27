import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import { Clock, CheckCircle2, XCircle, DollarSign } from "lucide-react"
import {
    parseOrderFilters,
    type OrderFiltersInput,
} from "./orders-filters"
import { OrdersDataTable } from "./orders-data-table"
import type { OrderRow } from "./orders-columns"
import { PageHeader, StatCard } from "@/app/admin/components"

export const dynamic = "force-dynamic"

type SearchParams = Promise<{
    page?: string
    pageSize?: string
    status?: string
    search?: string
    email?: string
    orderNo?: string
    dateFrom?: string
    dateTo?: string
}>

export default async function AdminOrdersPage({
    searchParams,
}: {
    searchParams: SearchParams
}) {
    const rawParams = await searchParams
    const filters = parseOrderFilters(rawParams as OrderFiltersInput)

    const page = filters.page
    const pageSize = filters.pageSize

    const where: Record<string, unknown> = {}

    if (filters.statusList.length > 0) {
        where.status = { in: filters.statusList }
    }
    if (filters.search) {
        const term = filters.search.trim().toLowerCase()
        where.OR = [
            { email: { contains: term, mode: "insensitive" } },
            { orderNo: { contains: filters.search.trim() } },
        ]
    } else {
        if (filters.email) {
            where.email = filters.email.trim().toLowerCase()
        }
        if (filters.orderNo) {
            where.orderNo = {
                contains: filters.orderNo.trim(),
            }
        }
    }

    let fromDate: Date | undefined
    let toDate: Date | undefined

    if (filters.dateFrom) {
        const parsed = new Date(filters.dateFrom)
        if (!Number.isNaN(parsed.getTime())) {
            fromDate = parsed
        }
    }

    if (filters.dateTo) {
        const parsed = new Date(filters.dateTo)
        if (!Number.isNaN(parsed.getTime())) {
            toDate = parsed
        }
    }

    if (fromDate || toDate) {
        const createdAt: { gte?: Date; lte?: Date } = {}
        if (fromDate) {
            createdAt.gte = fromDate
        }
        if (toDate) {
            createdAt.lte = toDate
        }
        where.createdAt = createdAt
    }

    const [orders, total, statusCounts, revenueAgg] = await Promise.all([
        prisma.order.findMany({
            where,
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        price: true,
                    },
                },
                distributor: {
                    select: { id: true, name: true, distributorCode: true },
                },
                cards: {
                    select: {
                        status: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.order.count({ where }),
        prisma.order.groupBy({
            by: ["status"],
            _count: { id: true },
        }),
        prisma.order.aggregate({
            where: { status: "COMPLETED" },
            _sum: { amount: true },
        }),
    ])

    const orderStats = {
        PENDING: statusCounts.find((c) => c.status === "PENDING")?._count.id ?? 0,
        COMPLETED: statusCounts.find((c) => c.status === "COMPLETED")?._count.id ?? 0,
        CLOSED: statusCounts.find((c) => c.status === "CLOSED")?._count.id ?? 0,
    }
    const totalRevenue = Number(revenueAgg._sum.amount ?? 0)

    const serializedOrders: OrderRow[] = orders.map((order) => {
        const cardsCount = order.cards.length
        const reservedCardsCount = order.cards.filter((c) => c.status === "RESERVED").length
        const soldCardsCount = order.cards.filter((c) => c.status === "SOLD").length

        return {
            id: order.id,
            orderNo: order.orderNo,
            email: order.email,
            distributorId: order.distributorId,
            distributor: order.distributor
                ? { id: order.distributor.id, name: order.distributor.name, distributorCode: order.distributor.distributorCode }
                : null,
            product: {
                id: order.product.id,
                name: order.product.name,
                price: Number(order.product.price),
            },
            quantity: order.quantity,
            amount: Number(order.amount),
            status: order.status,
            paymentMethod: order.paymentMethod,
            paidAt: order.paidAt ? order.paidAt.toISOString() : null,
            createdAt: order.createdAt.toISOString(),
            cardsCount,
            reservedCardsCount,
            soldCardsCount,
        }
    })

    const buildStatusLink = (statusKey: "PENDING" | "COMPLETED" | "CLOSED") => {
        const params = new URLSearchParams()
        const nextList = filters.statusList.includes(statusKey)
            ? filters.statusList.filter((s) => s !== statusKey)
            : [...filters.statusList, statusKey]
        if (nextList.length > 0) {
            params.set("status", nextList.join(","))
        }
        const query = params.toString()
        return `/admin/orders${query ? `?${query}` : ""}`
    }

    return (
        <div className="space-y-6">
            <PageHeader title="订单管理" description="查看和管理客户订单" />

            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                <StatCard
                    label="待完成"
                    value={orderStats.PENDING}
                    icon={Clock}
                    borderColor="border-l-warning"
                    iconColor="text-warning"
                    active={filters.statusList.includes("PENDING")}
                    href={buildStatusLink("PENDING")}
                />
                <StatCard
                    label="已完成"
                    value={orderStats.COMPLETED}
                    icon={CheckCircle2}
                    borderColor="border-l-success"
                    iconColor="text-success"
                    active={filters.statusList.includes("COMPLETED")}
                    href={buildStatusLink("COMPLETED")}
                />
                <StatCard
                    label="已关闭"
                    value={orderStats.CLOSED}
                    icon={XCircle}
                    borderColor="border-l-muted-foreground"
                    iconColor="text-muted-foreground"
                    active={filters.statusList.includes("CLOSED")}
                    href={buildStatusLink("CLOSED")}
                />
                <StatCard
                    label="总营收"
                    value={formatCurrency(totalRevenue)}
                    icon={DollarSign}
                    borderColor="border-l-primary"
                    iconColor="text-primary"
                />
            </div>

            <OrdersDataTable
                data={serializedOrders}
                total={total}
                statusCounts={orderStats}
            />
        </div>
    )
}

