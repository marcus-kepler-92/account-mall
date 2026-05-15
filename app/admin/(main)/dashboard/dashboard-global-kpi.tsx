import { formatCurrency } from "@/lib/utils"
import type { GlobalKPI } from "./dashboard-data"

export function DashboardGlobalKPI({ kpi }: { kpi: GlobalKPI }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs text-muted-foreground">今日营收</p>
        <p className="mt-1 text-xl font-bold">{formatCurrency(kpi.todayRevenue)}</p>
      </div>
      <div className="rounded-lg border bg-card p-3">
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          今日净利润
          {kpi.hasMissingCost && (
            <span title="部分商品未设成本，利润偏高" className="cursor-help">⚠</span>
          )}
        </p>
        <p className="mt-1 text-xl font-bold text-green-600">{formatCurrency(kpi.todayProfit)}</p>
      </div>
      <div className="rounded-lg border bg-card p-3">
        <p className="text-xs text-muted-foreground">今日订单</p>
        <p className="mt-1 text-xl font-bold">{kpi.todayOrders}</p>
      </div>
      <div className={`rounded-lg border bg-card p-3 ${kpi.lowStockCount > 0 ? "border-red-200 bg-red-50/50" : ""}`}>
        <p className="text-xs text-muted-foreground">库存需关注</p>
        <p className={`mt-1 text-xl font-bold ${kpi.lowStockCount > 0 ? "text-red-500" : ""}`}>
          {kpi.lowStockCount > 0 ? `${kpi.lowStockCount} 款` : "正常"}
        </p>
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
          缺货或低于预警线
        </p>
      </div>
    </div>
  )
}
