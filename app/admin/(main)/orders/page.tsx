import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { ShoppingCart, Clock, CheckCircle2, XCircle, DollarSign } from "lucide-react"
import Link from "next/link"
import {
    DEFAULT_ORDER_FILTERS,
    parseOrderFilters,
    type OrderFiltersInput,
} from "./orders-filters"
import { OrdersDataTable } from "./orders-data-table"
import type { OrderRow } from "./orders-columns"

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

    const hasFilters =
        filters.statusList.length > 0 ||
        filters.search ||
        filters.email ||
        filters.orderNo ||
        filters.dateFrom ||
        filters.dateTo

    const statCards = [
        {
            key: "PENDING" as const,
            label: "待完成",
            value: String(orderStats.PENDING),
            icon: Clock,
            color: "text-warning",
            borderColor: "border-l-warning",
            active: filters.statusList.includes("PENDING"),
        },
        {
            key: "COMPLETED" as const,
            label: "已完成",
            value: String(orderStats.COMPLETED),
            icon: CheckCircle2,
            color: "text-success",
            borderColor: "border-l-success",
            active: filters.statusList.includes("COMPLETED"),
        },
        {
            key: "CLOSED" as const,
            label: "已关闭",
            value: String(orderStats.CLOSED),
            icon: XCircle,
            color: "text-muted-foreground",
            borderColor: "border-l-muted-foreground",
            active: filters.statusList.includes("CLOSED"),
        },
        {
            key: "REVENUE",
            label: "总营收",
            value: `¥${totalRevenue.toFixed(2)}`,
            icon: DollarSign,
            color: "text-primary",
            borderColor: "border-l-primary",
            active: false,
            noLink: true,
        },
    ]

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">订单管理</h2>
                    <p className="text-muted-foreground">
                        查看和管理客户订单
                    </p>
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => {
                    const cardEl = (
                        <Card className={`border-l-4 ${stat.borderColor} transition-colors ${!("noLink" in stat && stat.noLink) ? "hover:bg-accent/50 cursor-pointer" : ""} ${stat.active ? "ring-2 ring-primary/20 bg-accent/30" : ""}`}>
                            <CardContent className="pt-4 pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                                        <p className="text-2xl font-bold mt-1">{stat.value}</p>
                                    </div>
                                    <stat.icon className={`size-8 ${stat.color} opacity-80`} />
                                </div>
                            </CardContent>
                        </Card>
                    )
                    if ("noLink" in stat && stat.noLink) return <div key={stat.key}>{cardEl}</div>
                    const statusKey = stat.key as "PENDING" | "COMPLETED" | "CLOSED"
                    return (
                        <Link key={stat.key} href={buildStatusLink(statusKey)}>
                            {cardEl}
                        </Link>
                    )
                })}
            </div>

            {/* Orders DataTable (Toolbar + SelectionBar + Table + Pagination) */}
            <OrdersDataTable
                data={serializedOrders}
                total={total}
                statusCounts={orderStats}
            />
        </div>
    )
}

