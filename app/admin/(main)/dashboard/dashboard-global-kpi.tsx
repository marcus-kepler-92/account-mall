import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import type { GlobalKPI } from "./dashboard-data"

export function DashboardGlobalKPI({ kpi }: { kpi: GlobalKPI }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card>
        <CardContent>
          <p className="text-xs text-muted-foreground">今日营收</p>
          <p className="mt-1 text-xl font-bold">{formatCurrency(kpi.todayRevenue)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            今日净利润
            {kpi.hasMissingCost && (
              <span title="部分商品未设成本，利润偏高" className="cursor-help">⚠</span>
            )}
          </p>
          <p
            className={`mt-1 text-xl font-bold ${
              kpi.todayProfit < 0
                ? "text-destructive"
                : kpi.todayProfit > 0
                  ? "text-success"
                  : "text-foreground"
            }`}
          >
            {formatCurrency(kpi.todayProfit)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <p className="text-xs text-muted-foreground">今日订单</p>
          <p className="mt-1 text-xl font-bold">{kpi.todayOrders}</p>
        </CardContent>
      </Card>
      <Card
        className={
          kpi.lowStockCount > 0
            ? "border-red-200 bg-red-50/50 dark:border-red-900/60 dark:bg-red-950/30"
            : ""
        }
      >
        <CardContent>
          <p className="text-xs text-muted-foreground">库存需关注</p>
          <p
            className={`mt-1 text-xl font-bold ${
              kpi.lowStockCount > 0 ? "text-red-600 dark:text-red-400" : ""
            }`}
          >
            {kpi.lowStockCount > 0 ? `${kpi.lowStockCount} 款` : "正常"}
          </p>
          <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
            与下方库存表一致（上架中 · 普通商品）
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
