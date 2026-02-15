import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
    DollarSign,
    ShoppingCart,
    Percent,
    TrendingUp,
    CreditCard,
    Bell,
} from "lucide-react"
import { getDashboardData } from "./dashboard-data"
import { ORDER_STATUS_LABEL } from "./types"
import { DashboardTrendSection } from "@/app/components/dashboard-trend-section"
import { DashboardOrderStatusChart } from "@/app/components/dashboard-order-status-chart"
import { DashboardTopProductsChart } from "@/app/components/dashboard-top-products-chart"
import { DashboardInventoryAlerts } from "@/app/components/dashboard-inventory-alerts"
import { DashboardRestockPending } from "@/app/components/dashboard-restock-pending"
import { config } from "@/lib/config"

export const dynamic = "force-dynamic"

const sectionGap = "space-y-6 sm:space-y-8"
const cardGrid = "grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-[repeat(2,minmax(0,1fr))]"
const kpiGrid =
    "grid grid-cols-1 gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))] xl:grid-cols-[repeat(6,minmax(0,1fr))]"

export default async function AdminDashboardPage() {
    const data = await getDashboardData()
    const { kpis, trend7, trend30, orderStatusDistribution, topProducts, inventory, restockPending, recentOrders } =
        data

    const kpiCards = [
        {
            title: "总营收",
            value: `¥${kpis.totalRevenue.toFixed(2)}`,
            description: "已完成订单总金额",
            href: "/admin/orders",
            icon: DollarSign,
            trend: kpis.revenueTrend,
            ariaLabel: `总营收 ${kpis.totalRevenue.toFixed(2)} 元，较上周 ${kpis.revenueTrend >= 0 ? "增" : "降"} ${Math.abs(kpis.revenueTrend).toFixed(0)}%，查看订单`,
        },
        {
            title: "订单数",
            value: String(kpis.orderCount),
            description: "订单总数",
            href: "/admin/orders",
            icon: ShoppingCart,
            trend: kpis.orderTrend,
            ariaLabel: `订单数 ${kpis.orderCount}，较上周 ${kpis.orderTrend >= 0 ? "增" : "降"} ${Math.abs(kpis.orderTrend).toFixed(0)}%，查看订单`,
        },
        {
            title: "完成率",
            value: `${kpis.completionRate.toFixed(1)}%`,
            description: "已完成 / 总订单",
            href: "/admin/orders",
            icon: Percent,
            ariaLabel: `完成率 ${kpis.completionRate.toFixed(1)}%，查看订单`,
        },
        {
            title: "客单价",
            value: kpis.completedCount > 0 ? `¥${kpis.aov.toFixed(2)}` : "—",
            description: "平均订单金额",
            href: "/admin/orders",
            icon: TrendingUp,
            ariaLabel: `客单价 ${kpis.aov.toFixed(2)} 元，查看订单`,
        },
        {
            title: "卡密库存",
            value: String(kpis.unsoldCardCount),
            description: "未售出卡密总数",
            href: "/admin/cards",
            icon: CreditCard,
            ariaLabel: `卡密库存 ${kpis.unsoldCardCount}，管理卡密`,
        },
        {
            title: "待补货需求",
            value: String(kpis.restockPendingCount),
            description: "待通知到货提醒人数",
            href: "/admin/products",
            icon: Bell,
            ariaLabel: `待补货需求 ${kpis.restockPendingCount} 人，查看商品`,
        },
    ]

    return (
        <div className={sectionGap}>
            <header>
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">概览</h2>
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                    欢迎使用 {config.siteName} {config.adminPanelLabel}
                </p>
            </header>

            <section className="min-w-0" aria-label="核心指标">
                <div className={kpiGrid}>
                    {kpiCards.map((stat) => (
                        <Link
                            key={stat.title}
                            href={stat.href}
                            aria-label={stat.ariaLabel}
                            className="block h-full min-w-0"
                        >
                            <Card className="flex h-full min-w-0 flex-col transition-colors hover:bg-accent/50 cursor-pointer">
                                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                                    <CardDescription className="min-w-0 truncate">
                                        {stat.description}
                                    </CardDescription>
                                    <stat.icon className="size-4 shrink-0 text-muted-foreground" />
                                </CardHeader>
                                <CardContent className="flex min-w-0 flex-1 flex-col justify-end">
                                    <div
                                        className="truncate text-lg font-bold sm:text-xl xl:text-2xl"
                                        title={stat.value}
                                    >
                                        {stat.value}
                                    </div>
                                    <div className="mt-1 flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground sm:text-sm">
                                            查看 →
                                        </span>
                                        {"trend" in stat &&
                                            typeof stat.trend === "number" &&
                                            stat.trend !== 0 && (
                                                <span
                                                    className={
                                                        stat.trend > 0
                                                            ? "text-xs text-green-600"
                                                            : "text-xs text-red-600"
                                                    }
                                                >
                                                    {stat.trend > 0 ? "↑" : "↓"}{" "}
                                                    {Math.abs(stat.trend).toFixed(0)}%
                                                </span>
                                            )}
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </section>

            <section className={`min-w-0 ${cardGrid}`} aria-label="趋势与分布">
                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle className="text-base sm:text-lg">近 7 / 30 日趋势</CardTitle>
                        <CardDescription>订单数与营收</CardDescription>
                    </CardHeader>
                    <CardContent className="min-w-0">
                        <DashboardTrendSection trend7={trend7} trend30={trend30} />
                    </CardContent>
                </Card>
                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle className="text-base sm:text-lg">订单状态分布</CardTitle>
                        <CardDescription>已完成 / 待支付 / 已关闭</CardDescription>
                    </CardHeader>
                    <CardContent className="min-w-0">
                        <DashboardOrderStatusChart data={orderStatusDistribution} />
                    </CardContent>
                </Card>
            </section>

            <section className={`min-w-0 ${cardGrid}`} aria-label="商品与库存">
                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle className="text-base sm:text-lg">商品表现 Top 8</CardTitle>
                        <CardDescription>按营收排序</CardDescription>
                    </CardHeader>
                    <CardContent className="min-w-0">
                        <DashboardTopProductsChart data={topProducts} />
                    </CardContent>
                </Card>
                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle className="text-base sm:text-lg">库存预警</CardTitle>
                        <CardDescription>各商品未售出卡密数量</CardDescription>
                    </CardHeader>
                    <CardContent className="min-w-0">
                        <DashboardInventoryAlerts data={inventory} />
                    </CardContent>
                </Card>
            </section>

            <section className={`min-w-0 ${cardGrid}`} aria-label="订单与补货">
                <Card className="min-w-0">
                    <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <CardTitle className="text-base sm:text-lg">最近订单</CardTitle>
                            <CardDescription>最新 10 笔订单</CardDescription>
                        </div>
                        <Link
                            href="/admin/orders"
                            className="shrink-0 text-sm text-muted-foreground hover:underline"
                        >
                            查看全部
                        </Link>
                    </CardHeader>
                    <CardContent className="min-w-0">
                        {recentOrders.length > 0 ? (
                            <div className="overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>订单号</TableHead>
                                            <TableHead>商品</TableHead>
                                            <TableHead>金额</TableHead>
                                            <TableHead className="hidden sm:table-cell">下单时间</TableHead>
                                            <TableHead>状态</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {recentOrders.map((order) => (
                                            <TableRow key={order.id}>
                                                <TableCell className="font-mono text-xs sm:text-sm">
                                                    {order.orderNo}
                                                </TableCell>
                                                <TableCell className="max-w-[120px] truncate sm:max-w-none">
                                                    {order.product.name}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    ¥{Number(order.amount).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="hidden text-muted-foreground text-sm sm:table-cell">
                                                    {order.createdAt.toLocaleString("zh-CN", {
                                                        month: "numeric",
                                                        day: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </TableCell>
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
                                                        {ORDER_STATUS_LABEL[order.status]}
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
                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle className="text-base sm:text-lg">待通知到货提醒</CardTitle>
                        <CardDescription>缺货商品的订阅人数</CardDescription>
                    </CardHeader>
                    <CardContent className="min-w-0">
                        <DashboardRestockPending data={restockPending} />
                    </CardContent>
                </Card>
            </section>
        </div>
    )
}
