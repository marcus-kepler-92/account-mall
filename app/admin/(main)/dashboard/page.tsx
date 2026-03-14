import Link from "next/link"
import { cn, formatDateTimeShort } from "@/lib/utils"
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
    Package,
    Users,
    Wallet,
    Minus,
    ArrowUpRight,
} from "lucide-react"
import { getDashboardData } from "./dashboard-data"
import { ORDER_STATUS_LABEL } from "./types"
import { DashboardInventoryAlerts } from "./dashboard-inventory-alerts"
import { DashboardRestockPending } from "./dashboard-restock-pending"
import {
    DashboardTrendSection,
    DashboardOrderStatusChart,
    DashboardTopProductsChart,
} from "./dashboard-charts"
import { config } from "@/lib/config"

export const dynamic = "force-dynamic"

const sectionGap = "space-y-6 sm:space-y-8"
const cardGrid = "grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-[repeat(2,minmax(0,1fr))]"

function KpiCard({
    title,
    value,
    subValue,
    description,
    href,
    icon: Icon,
    trend,
    accentColor,
}: {
    title: string
    value: string
    subValue?: string
    description: string
    href: string
    icon: React.ElementType
    trend?: number
    accentColor?: string
}) {
    return (
        <Link href={href} className="block h-full min-w-0">
            <Card className="flex h-full min-w-0 flex-col transition-colors hover:bg-accent/50 cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardDescription className="min-w-0 truncate text-xs sm:text-sm">
                        {description}
                    </CardDescription>
                    <Icon className={cn("size-4 shrink-0", accentColor ?? "text-muted-foreground")} />
                </CardHeader>
                <CardContent className="flex min-w-0 flex-1 flex-col justify-end">
                    <div className="truncate text-lg font-bold sm:text-xl xl:text-2xl" title={value}>
                        {value}
                    </div>
                    {subValue && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{subValue}</div>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">查看 →</span>
                        {typeof trend === "number" && trend !== 0 && (
                            <span className={trend > 0 ? "text-xs text-green-600" : "text-xs text-red-600"}>
                                {trend > 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(0)}%
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}

export default async function AdminDashboardPage() {
    const data = await getDashboardData()
    const { kpis, trend7, trend30, orderStatusDistribution, topProducts, inventory, restockPending, recentOrders } =
        data

    const marginColor =
        kpis.netMarginPercent >= 80
            ? "text-green-600"
            : kpis.netMarginPercent >= 60
              ? "text-yellow-600"
              : "text-red-600"

    return (
        <div className={sectionGap}>
            <header>
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">概览</h2>
                <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                    欢迎使用 {config.siteName} {config.adminPanelLabel}
                </p>
            </header>

            {/* 第一层：财务核心 */}
            <section className="min-w-0" aria-label="财务核心指标">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    财务核心
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard
                        title="累计收款"
                        value={`¥${kpis.totalRevenue.toFixed(2)}`}
                        description="已完成订单的总收款金额"
                        href="/admin/orders"
                        icon={DollarSign}
                        trend={kpis.revenueTrend}
                        accentColor="text-primary"
                    />
                    <KpiCard
                        title="平台实得"
                        value={`¥${kpis.netIncome.toFixed(2)}`}
                        description="扣除分销佣金后，平台实际留存"
                        href="/admin/distributors"
                        icon={TrendingUp}
                        trend={kpis.netIncomeTrend}
                        accentColor="text-green-600"
                    />
                    <KpiCard
                        title="已结算佣金"
                        value={`¥${kpis.totalCommission.toFixed(2)}`}
                        description="已发放给分销员的佣金总额"
                        href="/admin/distributors"
                        icon={Minus}
                        accentColor="text-orange-500"
                    />
                    <Link href="/admin/orders" className="block h-full min-w-0">
                        <Card className="flex h-full min-w-0 flex-col transition-colors hover:bg-accent/50 cursor-pointer">
                            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                                <CardDescription className="min-w-0 truncate text-xs sm:text-sm">
                                    收入留存率
                                </CardDescription>
                                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                            </CardHeader>
                            <CardContent className="flex min-w-0 flex-1 flex-col justify-end">
                                <div className={cn("text-lg font-bold sm:text-xl xl:text-2xl", marginColor)}>
                                    {kpis.netMarginPercent.toFixed(1)}%
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                    {kpis.totalRevenue > 0
                                        ? `每收 ¥100，留 ¥${kpis.netMarginPercent.toFixed(1)}`
                                        : "暂无数据"}
                                </div>
                                <div className="mt-1">
                                    <span className="text-xs text-muted-foreground">查看 →</span>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            </section>

            {/* 第二层：运营效率 */}
            <section className="min-w-0" aria-label="运营效率指标">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    运营效率
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard
                        title="订单数"
                        value={String(kpis.orderCount)}
                        description="订单总数"
                        href="/admin/orders"
                        icon={ShoppingCart}
                        trend={kpis.orderTrend}
                    />
                    <KpiCard
                        title="客单价"
                        value={kpis.completedCount > 0 ? `¥${kpis.aov.toFixed(2)}` : "—"}
                        description="平均订单金额"
                        href="/admin/orders"
                        icon={DollarSign}
                    />
                    <KpiCard
                        title="完成率"
                        value={`${kpis.completionRate.toFixed(1)}%`}
                        description="已完成 / 总订单"
                        href="/admin/orders"
                        icon={Percent}
                    />
                    <KpiCard
                        title="卡密库存"
                        value={String(kpis.unsoldCardCount)}
                        description="未售出卡密总数"
                        href="/admin/cards"
                        icon={CreditCard}
                    />
                </div>
            </section>

            {/* 第三层：待办事项 */}
            <section className="min-w-0" aria-label="待办事项">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    待办事项
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <KpiCard
                        title="待处理提现"
                        value={
                            kpis.pendingWithdrawalCount > 0
                                ? `${kpis.pendingWithdrawalCount} 笔 · ¥${kpis.pendingWithdrawalAmount.toFixed(2)}`
                                : "0 笔"
                        }
                        description="待处理提现笔数与金额"
                        href="/admin/withdrawals?status=PENDING"
                        icon={Wallet}
                    />
                    <KpiCard
                        title="待补货需求"
                        value={String(kpis.restockPendingCount)}
                        description="待通知补货提醒人数"
                        href="/admin/products"
                        icon={Bell}
                    />
                    <KpiCard
                        title="在售商品 / 分销员"
                        value={`${kpis.activeProductCount} / ${kpis.distributorCount}`}
                        description="在售商品数 / 分销员总数"
                        href="/admin/products"
                        icon={Package}
                    />
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
                                                    {order.productNameSnapshot ?? order.product.name}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    ¥{Number(order.amount).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="hidden text-muted-foreground text-sm sm:table-cell">
                                                    {formatDateTimeShort(order.createdAt)}
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
                        <CardTitle className="text-base sm:text-lg">待通知补货提醒</CardTitle>
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
