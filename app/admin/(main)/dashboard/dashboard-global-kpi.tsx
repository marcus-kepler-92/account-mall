import { AlertTriangle, Info } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
            今日运营利润
            <TooltipProvider>
              {kpi.hasMissingCost && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="size-3.5 cursor-help text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>部分商品未设成本，利润偏高</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 cursor-help text-muted-foreground/70" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  营收 − 成本 − 佣金。里程碑奖金为跨期费用，不计入日维度运营利润；查看完整净利润请到利润看板选择更长时间窗口。
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
      <Card>
        <CardContent>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            今日转化率
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 cursor-help text-muted-foreground/70" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  付费订单 ÷（免费领取 + 付费订单）。免费引流转化为付费购买的比例。
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </p>
          <p className="mt-1 text-xl font-bold">
            {(kpi.todayConversionRate * 100).toFixed(1)}%
          </p>
          <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
            付费 {kpi.todayPaidCount} · 领取 {kpi.todayFreeCount}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
