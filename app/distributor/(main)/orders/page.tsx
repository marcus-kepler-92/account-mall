import { redirect } from "next/navigation"
import Link from "next/link"
import { getDistributorSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { DistributorOrdersPagination } from "./orders-pagination"
import { EmptyState } from "@/app/components/empty-state"
import { ShoppingCart } from "lucide-react"

export const dynamic = "force-dynamic"

const statusConfig: Record<string, { label: string; variant: "warning" | "success" | "secondary" }> = {
    PENDING: { label: "待支付", variant: "warning" },
    COMPLETED: { label: "已完成", variant: "success" },
    CLOSED: { label: "已关闭", variant: "secondary" },
}

export default async function DistributorOrdersPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; status?: string }>
}) {
    const session = await getDistributorSession()
    if (!session) redirect("/distributor/login")

    const user = session.user as { id: string }
    const params = await searchParams
    const page = Math.max(1, parseInt(params.page ?? "1", 10))
    const pageSize = 20
    const status = params.status as "PENDING" | "COMPLETED" | "CLOSED" | undefined

    const where: { distributorId: string; status?: "PENDING" | "COMPLETED" | "CLOSED" } = {
        distributorId: user.id,
    }
    if (status) where.status = status

    const [orders, total] = await Promise.all([
        prisma.order.findMany({
            where,
            include: { product: { select: { name: true, slug: true, price: true } } },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.order.count({ where }),
    ])

    const totalPages = Math.ceil(total / pageSize) || 1

    const statusTabs = [
        { value: undefined, label: "全部" },
        { value: "PENDING" as const, label: "待支付" },
        { value: "COMPLETED" as const, label: "已完成" },
        { value: "CLOSED" as const, label: "已关闭" },
    ]

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">我的订单</h1>
                <p className="text-muted-foreground">归属您的全部订单明细</p>
            </div>

            <div className="flex gap-1 border-b border-border">
                {statusTabs.map((tab) => {
                    const isActive = status === tab.value
                    const href = tab.value
                        ? `/distributor/orders?status=${tab.value}`
                        : "/distributor/orders"
                    return (
                        <Link
                            key={tab.value ?? "all"}
                            href={href}
                            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-md -mb-px border-b-2 ${
                                isActive
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {tab.label}
                        </Link>
                    )
                })}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>订单列表</CardTitle>
                    <CardDescription>共 {total} 笔订单</CardDescription>
                </CardHeader>
                <CardContent>
                    {orders.length === 0 ? (
                        <EmptyState
                            icon={<ShoppingCart className="size-8 text-muted-foreground" />}
                            title="暂无订单"
                            description="分享推广链接获得订单后将在此展示。"
                        />
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>订单号</TableHead>
                                        <TableHead>商品</TableHead>
                                        <TableHead>数量</TableHead>
                                        <TableHead className="text-right">金额</TableHead>
                                        <TableHead>状态</TableHead>
                                        <TableHead>时间</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {orders.map((o) => (
                                        <TableRow key={o.id}>
                                            <TableCell className="font-mono text-xs">
                                                {o.orderNo}
                                            </TableCell>
                                            <TableCell>{o.product.name}</TableCell>
                                            <TableCell>{o.quantity}</TableCell>
                                            <TableCell className="text-right">
                                                ¥{Number(o.amount).toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={statusConfig[o.status]?.variant ?? "outline"}>
                                                    {statusConfig[o.status]?.label ?? o.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(o.createdAt).toLocaleString("zh-CN")}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {totalPages > 1 && (
                                <DistributorOrdersPagination
                                    page={page}
                                    totalPages={totalPages}
                                    total={total}
                                    currentStatus={status}
                                />
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
