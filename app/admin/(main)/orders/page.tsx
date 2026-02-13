import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { ShoppingCart } from "lucide-react"
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

    const [orders, total] = await Promise.all([
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
    ])

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

    const getStatusBadgeVariant = (status: string) => {
        if (status === "COMPLETED") return "default" as const
        if (status === "PENDING") return "secondary" as const
        return "outline" as const
    }

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
                <div className="text-sm text-muted-foreground">
                    共 <span className="font-medium">{total}</span> 笔订单
                </div>
            </div>

            {/* Search & Filter bar */}
            <OrdersFilterBar initialFilters={filters} />

            {/* Orders table */}
            {serializedOrders.length > 0 ? (
                <div className="space-y-4">
                    <div className="overflow-x-auto rounded-md border bg-card">
                        <table className="min-w-full text-sm">
                            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium">订单号</th>
                                    <th className="px-4 py-2 text-left font-medium">邮箱</th>
                                    <th className="px-4 py-2 text-left font-medium">商品</th>
                                    <th className="px-4 py-2 text-right font-medium">数量</th>
                                    <th className="px-4 py-2 text-right font-medium">金额</th>
                                    <th className="px-4 py-2 text-center font-medium">状态</th>
                                    <th className="px-4 py-2 text-center font-medium">卡密</th>
                                    <th className="px-4 py-2 text-right font-medium">创建时间</th>
                                </tr>
                            </thead>
                            <tbody>
                                {serializedOrders.map((order) => (
                                    <tr
                                        key={order.id}
                                        className="border-b last:border-0 hover:bg-muted/40"
                                    >
                                        <td className="px-4 py-2 align-middle">
                                            <span className="font-mono text-xs">
                                                {order.orderNo}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 align-middle">
                                            <span className="text-xs text-muted-foreground">
                                                {order.email}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 align-middle">
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {order.product.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    ¥{order.product.price.toFixed(2)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-right align-middle">
                                            {order.quantity}
                                        </td>
                                        <td className="px-4 py-2 text-right align-middle">
                                            ¥{order.amount.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2 text-center align-middle">
                                            <Badge variant={getStatusBadgeVariant(order.status)}>
                                                {order.status === "PENDING"
                                                    ? "待完成"
                                                    : order.status === "COMPLETED"
                                                        ? "已完成"
                                                        : "已关闭"}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-2 text-center align-middle">
                                            <span className="text-xs text-muted-foreground">
                                                {order.soldCardsCount}/{order.cardsCount} 已售
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right align-middle">
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
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div>
                            第 <span className="font-medium">{page}</span> /
                            <span className="font-medium">{totalPages}</span> 页，
                            每页 <span className="font-medium">{pageSize}</span> 条
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                            >
                                <Link href={buildPageLink(page - 1)}>上一页</Link>
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                            >
                                <Link href={buildPageLink(page + 1)}>下一页</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="rounded-full bg-muted p-4 mb-4">
                            <ShoppingCart className="size-8 text-muted-foreground" />
                        </div>
                        <CardTitle className="mb-2">暂无订单</CardTitle>
                        <CardDescription className="mb-4 text-center max-w-sm">
                            客户购买后订单将显示在这里，你可以通过筛选快速定位指定订单。
                        </CardDescription>
                        <CardDescription className="text-xs text-muted-foreground">
                            可以先在前台完成一次测试下单，刷新此页面查看效果。
                        </CardDescription>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

