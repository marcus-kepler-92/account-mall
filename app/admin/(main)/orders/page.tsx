import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ShoppingCart, ChevronLeft, ChevronRight, Clock, CheckCircle2, XCircle, DollarSign } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
    DEFAULT_ORDER_FILTERS,
    parseOrderFilters,
    type OrderFiltersInput,
} from "./orders-filters"
import { OrdersFilterBar } from "./orders-filter-bar"

export const dynamic = "force-dynamic"

type SearchParams = Promise<{
    page?: string
    pageSize?: string
    status?: string
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

    if (filters.status !== "ALL") {
        where.status = filters.status
    }
    if (filters.email) {
        where.email = filters.email.trim().toLowerCase()
    }
    if (filters.orderNo) {
        where.orderNo = {
            contains: filters.orderNo.trim(),
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

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const serializedOrders = orders.map((order) => {
        const cardsCount = order.cards.length
        const reservedCardsCount = order.cards.filter((c) => c.status === "RESERVED").length
        const soldCardsCount = order.cards.filter((c) => c.status === "SOLD").length

        return {
            id: order.id,
            orderNo: order.orderNo,
            email: order.email,
            product: {
                id: order.product.id,
                name: order.product.name,
                price: Number(order.product.price),
            },
            quantity: order.quantity,
            amount: Number(order.amount),
            status: order.status,
            paidAt: order.paidAt,
            createdAt: order.createdAt,
            cardsCount,
            reservedCardsCount,
            soldCardsCount,
        }
    })

    const buildPageLink = (targetPage: number) => {
        const paramsEntries = new URLSearchParams()
        const baseFilters = { ...DEFAULT_ORDER_FILTERS, ...filters, page: targetPage }

        if (baseFilters.page > 1) {
            paramsEntries.set("page", String(baseFilters.page))
        }
        if (baseFilters.pageSize !== DEFAULT_ORDER_FILTERS.pageSize) {
            paramsEntries.set("pageSize", String(baseFilters.pageSize))
        }
        if (baseFilters.status !== "ALL") {
            paramsEntries.set("status", baseFilters.status)
        }
        if (baseFilters.email) {
            paramsEntries.set("email", baseFilters.email)
        }
        if (baseFilters.orderNo) {
            paramsEntries.set("orderNo", baseFilters.orderNo)
        }
        if (baseFilters.dateFrom) {
            paramsEntries.set("dateFrom", baseFilters.dateFrom)
        }
        if (baseFilters.dateTo) {
            paramsEntries.set("dateTo", baseFilters.dateTo)
        }

        const query = paramsEntries.toString()
        return `/admin/orders${query ? `?${query}` : ""}`
    }

    const buildStatusLink = (status: string) => {
        const paramsEntries = new URLSearchParams()
        if (status !== "ALL") {
            paramsEntries.set("status", status)
        }
        const query = paramsEntries.toString()
        return `/admin/orders${query ? `?${query}` : ""}`
    }

    const hasFilters =
        filters.status !== "ALL" ||
        filters.email ||
        filters.orderNo ||
        filters.dateFrom ||
        filters.dateTo

    const statCards = [
        {
            key: "PENDING",
            label: "待完成",
            value: String(orderStats.PENDING),
            icon: Clock,
            color: "text-warning",
            borderColor: "border-l-warning",
            active: filters.status === "PENDING",
        },
        {
            key: "COMPLETED",
            label: "已完成",
            value: String(orderStats.COMPLETED),
            icon: CheckCircle2,
            color: "text-success",
            borderColor: "border-l-success",
            active: filters.status === "COMPLETED",
        },
        {
            key: "CLOSED",
            label: "已关闭",
            value: String(orderStats.CLOSED),
            icon: XCircle,
            color: "text-muted-foreground",
            borderColor: "border-l-muted-foreground",
            active: filters.status === "CLOSED",
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
                    return (
                        <Link key={stat.key} href={buildStatusLink(stat.active ? "ALL" : stat.key)}>
                            {cardEl}
                        </Link>
                    )
                })}
            </div>

            {/* Search & Filter bar */}
            <OrdersFilterBar initialFilters={filters} />

            {/* Orders table */}
            {serializedOrders.length > 0 ? (
                <Card>
                    {/* Table toolbar */}
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                        <p className="text-sm text-muted-foreground">
                            {hasFilters ? "筛选结果：" : ""}共 <span className="font-medium text-foreground">{total}</span> 笔订单
                        </p>
                    </div>

                    {/* Table */}
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="pl-4">订单号</TableHead>
                                <TableHead>邮箱</TableHead>
                                <TableHead>商品</TableHead>
                                <TableHead className="text-right">数量</TableHead>
                                <TableHead className="text-right">金额</TableHead>
                                <TableHead className="text-center">状态</TableHead>
                                <TableHead className="text-center">卡密</TableHead>
                                <TableHead className="text-right pr-4">创建时间</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {serializedOrders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="pl-4">
                                        <Link
                                            href={`/admin/orders/${order.id}`}
                                            className="font-mono text-xs hover:underline"
                                        >
                                            {order.orderNo}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {order.email}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                {order.product.name}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                ¥{order.product.price.toFixed(2)}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {order.quantity}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        ¥{order.amount.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge
                                            variant="outline"
                                            className={
                                                order.status === "COMPLETED"
                                                    ? "border-success/50 bg-success/10 text-success"
                                                    : order.status === "PENDING"
                                                        ? "border-warning/50 bg-warning/10 text-warning"
                                                        : "border-muted-foreground/30 bg-muted text-muted-foreground"
                                            }
                                        >
                                            {order.status === "PENDING"
                                                ? "待完成"
                                                : order.status === "COMPLETED"
                                                    ? "已完成"
                                                    : "已关闭"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className="text-xs text-muted-foreground">
                                            {order.soldCardsCount}/{order.cardsCount} 已售
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right pr-4">
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs">
                                                {order.createdAt.toLocaleString("zh-CN")}
                                            </span>
                                            {order.paidAt && (
                                                <span className="text-[11px] text-muted-foreground">
                                                    支付于 {order.paidAt.toLocaleString("zh-CN")}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                        <p className="text-sm text-muted-foreground">
                            第 <span className="font-medium">{page}</span> / {totalPages} 页
                        </p>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-8"
                                disabled={page <= 1}
                                asChild={page > 1}
                            >
                                {page > 1 ? (
                                    <Link href={buildPageLink(page - 1)}>
                                        <ChevronLeft className="size-4" />
                                    </Link>
                                ) : (
                                    <span><ChevronLeft className="size-4" /></span>
                                )}
                            </Button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum: number
                                if (totalPages <= 5) {
                                    pageNum = i + 1
                                } else if (page <= 3) {
                                    pageNum = i + 1
                                } else if (page >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i
                                } else {
                                    pageNum = page - 2 + i
                                }
                                return (
                                    <Button
                                        key={pageNum}
                                        variant={pageNum === page ? "default" : "outline"}
                                        size="icon"
                                        className="size-8"
                                        asChild={pageNum !== page}
                                    >
                                        {pageNum === page ? (
                                            <span>{pageNum}</span>
                                        ) : (
                                            <Link href={buildPageLink(pageNum)}>{pageNum}</Link>
                                        )}
                                    </Button>
                                )
                            })}
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-8"
                                disabled={page >= totalPages}
                                asChild={page < totalPages}
                            >
                                {page < totalPages ? (
                                    <Link href={buildPageLink(page + 1)}>
                                        <ChevronRight className="size-4" />
                                    </Link>
                                ) : (
                                    <span><ChevronRight className="size-4" /></span>
                                )}
                            </Button>
                        </div>
                    </div>
                </Card>
            ) : (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="rounded-full bg-muted p-4 mb-4">
                            <ShoppingCart className="size-8 text-muted-foreground" />
                        </div>
                        <CardTitle className="mb-2">
                            {hasFilters ? "当前筛选无结果" : "暂无订单"}
                        </CardTitle>
                        <CardDescription className="mb-4 text-center max-w-sm">
                            {hasFilters
                                ? "当前筛选条件下没有订单，请调整筛选条件后重试。"
                                : "客户购买后订单将显示在这里，你可以通过筛选快速定位指定订单。"}
                        </CardDescription>
                        {hasFilters && (
                            <Button asChild variant="outline">
                                <Link href="/admin/orders">重置筛选</Link>
                            </Button>
                        )}
                        {!hasFilters && (
                            <CardDescription className="text-xs text-muted-foreground">
                                可以先在前台完成一次测试下单，刷新此页面查看效果。
                            </CardDescription>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

