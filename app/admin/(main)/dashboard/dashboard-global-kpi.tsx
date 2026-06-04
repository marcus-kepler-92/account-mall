import Link from "next/link"
import { Info } from "lucide-react"
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
      {/* Growth — conversion (free → paid), the platform's funnel headline */}
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

      {/* Growth — distributor recruitment */}
      <Card>
        <CardContent>
          <p className="text-xs text-muted-foreground">今日新增分销员</p>
          <p className="mt-1 text-xl font-bold">{kpi.todayNewDistributors}</p>
        </CardContent>
      </Card>

      {/* Risk — refunds today */}
      <Card>
        <CardContent>
          <p className="text-xs text-muted-foreground">今日退款额</p>
          <p
            className={`mt-1 text-xl font-bold ${
              kpi.todayRefundAmount > 0 ? "text-destructive" : ""
            }`}
          >
            {formatCurrency(kpi.todayRefundAmount)}
          </p>
        </CardContent>
      </Card>

      {/* Action — manual fulfillment backlog, links to the fulfillment page */}
      <Link href="/admin/fulfillment" className="block">
        <Card
          className={
            kpi.awaitingFulfillmentCount > 0
              ? "border-amber-200 bg-amber-50/50 transition-colors hover:bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30"
              : "transition-colors hover:bg-muted/50"
          }
        >
          <CardContent>
            <p className="text-xs text-muted-foreground">待发货</p>
            <p
              className={`mt-1 text-xl font-bold ${
                kpi.awaitingFulfillmentCount > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : ""
              }`}
            >
              {kpi.awaitingFulfillmentCount > 0
                ? `${kpi.awaitingFulfillmentCount} 单`
                : "已清空"}
            </p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              人工发货待处理
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
