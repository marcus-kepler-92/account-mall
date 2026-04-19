// app/admin/(main)/dashboard/page.tsx
import Link from "next/link"
import { formatDateTimeShort } from "@/lib/utils"
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
import { getDashboardData } from "./dashboard-data"
import { ORDER_STATUS_LABEL } from "./types"
import { DashboardInventoryAlerts } from "./dashboard-inventory-alerts"
import { DashboardRestockPending } from "./dashboard-restock-pending"
import { DashboardTrendSection, DashboardTopProductsChart } from "./dashboard-charts"
import { DashboardSalesPanel } from "./dashboard-sales-panel"
import { DashboardDistributorPanel } from "./dashboard-distributor-panel"
import { config } from "@/lib/config"
import { PageHeader } from "@/app/admin/components"

export const dynamic = "force-dynamic"

const cardGrid = "grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-[repeat(2,minmax(0,1fr))]"

export default async function AdminDashboardPage() {
  const data = await getDashboardData()
  const { trend7, trend30, topProducts, inventory, restockPending, recentOrders } = data

  return (
    <div className="space-y-6">
      <PageHeader title="概览" description={`欢迎使用 ${config.siteName} ${config.adminPanelLabel}`} />

      <DashboardSalesPanel />

      <DashboardDistributorPanel />

      <section className={`min-w-0 ${cardGrid}`} aria-label="趋势与商品">
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
            <CardTitle className="text-base sm:text-lg">商品表现 Top 8</CardTitle>
            <CardDescription>按营收排序</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <DashboardTopProductsChart data={topProducts} />
          </CardContent>
        </Card>
      </section>

      <section className={`min-w-0 ${cardGrid}`} aria-label="库存与补货">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">库存预警</CardTitle>
            <CardDescription>各商品未售出卡密数量</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0">
            <DashboardInventoryAlerts data={inventory} />
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

      <section className="min-w-0" aria-label="最近订单">
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
              <p className="py-8 text-center text-sm text-muted-foreground">暂无订单</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
