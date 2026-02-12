import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, ShoppingCart, CreditCard, DollarSign } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DashboardChart } from "@/app/components/dashboard-chart"

export const dynamic = "force-dynamic"

async function getDashboardData() {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - 7)
    startOfWeek.setHours(0, 0, 0, 0)
    const startOfLastWeek = new Date(startOfWeek)
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7)

    const [productCount, orderCount, unsoldCardCount, revenue, revenueLastWeek, recentOrders, chartData] =
        await Promise.all([
            prisma.product.count(),
            prisma.order.count(),
            prisma.card.count({ where: { status: "UNSOLD" } }),
            prisma.order.aggregate({
                where: { status: "COMPLETED" },
                _sum: { amount: true },
            }),
            prisma.order.aggregate({
                where: {
                    status: "COMPLETED",
                    paidAt: { gte: startOfLastWeek, lt: startOfWeek },
                },
                _sum: { amount: true },
            }),
            prisma.order.findMany({
                take: 10,
                orderBy: { createdAt: "desc" },
                include: {
                    product: { select: { name: true } },
                },
            }),
            prisma.order.groupBy({
                by: ["createdAt"],
                where: {
                    createdAt: { gte: startOfWeek },
                    status: "COMPLETED",
                },
                _sum: { amount: true },
                _count: { id: true },
            }),
        ])

    const totalRevenue = Number(revenue._sum.amount ?? 0)
    const lastWeekRevenue = Number(revenueLastWeek._sum.amount ?? 0)
    const revenueTrend = lastWeekRevenue > 0
        ? ((totalRevenue - lastWeekRevenue) / lastWeekRevenue) * 100
        : totalRevenue > 0 ? 100 : 0

    const lastWeekOrders = await prisma.order.count({
        where: { createdAt: { gte: startOfLastWeek, lt: startOfWeek } },
    })
    const thisWeekOrders = await prisma.order.count({
        where: { createdAt: { gte: startOfWeek } },
    })
    const orderTrend = lastWeekOrders > 0
        ? ((thisWeekOrders - lastWeekOrders) / lastWeekOrders) * 100
        : thisWeekOrders > 0 ? 100 : 0

    const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now)
        d.setDate(d.getDate() - (6 - i))
        d.setHours(0, 0, 0, 0)
        return d
    })
    const chartByDay = days.map((d) => {
        const next = new Date(d)
        next.setDate(next.getDate() + 1)
        const dayOrders = chartData.filter(
            (o) => o.createdAt >= d && o.createdAt < next
        )
        const dayRevenue = dayOrders.reduce(
            (s, o) => s + Number(o._sum.amount ?? 0),
            0
        )
        return {
            date: d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
            订单: dayOrders.length,
            营收: dayRevenue,
        }
    })

    return {
        productCount,
        orderCount,
        unsoldCardCount,
        totalRevenue,
        revenueTrend,
        orderTrend,
        recentOrders,
        chartByDay,
    }
}

export default async function AdminDashboardPage() {
    const data = await getDashboardData()

    const stats = [
        {
            title: "商品",
            value: String(data.productCount),
            description: "商品总数",
            href: "/admin/products",
            icon: Package,
        },
        {
            title: "订单",
            value: String(data.orderCount),
            description: "订单总数",
            href: "/admin/orders",
            icon: ShoppingCart,
        },
        {
            title: "卡密",
            value: String(data.unsoldCardCount),
            description: "卡密库存",
            href: "/admin/cards",
            icon: CreditCard,
        },
        {
            title: "营收",
            value: `¥${data.totalRevenue.toFixed(2)}`,
            description: "已完成订单总金额",
            href: "/admin/orders",
            icon: DollarSign,
            trend: data.revenueTrend,
        },
    ]

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">概览</h2>
                <p className="text-muted-foreground">
                    欢迎使用 Account Mall 管理后台
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Link key={stat.title} href={stat.href}>
                        <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardDescription>{stat.description}</CardDescription>
                                <stat.icon className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{stat.value}</div>
                                <div className="mt-1 flex items-center gap-2">
                                    <p className="text-sm text-muted-foreground">
                                        管理{stat.title} →
                                    </p>
                                    {"trend" in stat && typeof stat.trend === "number" && stat.trend !== 0 && (
                                        <span
                                            className={`text-xs ${
                                                stat.trend > 0 ? "text-green-600" : "text-red-600"
                                            }`}
                                        >
                                            {stat.trend > 0 ? "↑" : "↓"} {Math.abs(stat.trend).toFixed(0)}%
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>近 7 日趋势</CardTitle>
                        <CardDescription>订单数与营收</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <DashboardChart data={data.chartByDay} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>最近订单</CardTitle>
                        <CardDescription>最新的 10 笔订单</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {data.recentOrders.length > 0 ? (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>订单号</TableHead>
                                            <TableHead>商品</TableHead>
                                            <TableHead>金额</TableHead>
                                            <TableHead>状态</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.recentOrders.map((order) => (
                                            <TableRow key={order.id}>
                                                <TableCell className="font-mono text-sm">
                                                    {order.orderNo}
                                                </TableCell>
                                                <TableCell>{order.product.name}</TableCell>
                                                <TableCell>¥{Number(order.amount).toFixed(2)}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            order.status === "COMPLETED"
                                                                ? "default"
                                                                : order.status === "PENDING"
                                                                  ? "secondary"
                                                                  : "outline"
                                                        }
                                                    >
                                                        {order.status === "COMPLETED"
                                                            ? "已完成"
                                                            : order.status === "PENDING"
                                                              ? "待支付"
                                                              : "已关闭"}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <p className="py-8 text-center text-sm text-muted-foreground">
                                暂无订单
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
