import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Coins, Users } from "lucide-react";

interface DashboardKpiSectionProps {
  orderCount: number;
  level1CommissionTotal: number;
  level2CommissionTotal: number;
  inviteeCount: number;
}

export function DashboardKpiSection({
  orderCount,
  level1CommissionTotal,
  level2CommissionTotal,
  inviteeCount,
}: DashboardKpiSectionProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {/* 累计推广奖金 */}
      <Card className="py-0">
        <CardContent className="pt-4 pb-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Coins className="size-3.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">累计推广奖金</p>
            </div>
            <p className="text-sm font-bold tabular-nums shrink-0">
              ¥{level1CommissionTotal.toFixed(2)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground pl-5">直接销售所得</p>
        </CardContent>
      </Card>

      {/* 成交订单数 */}
      <Card className="py-0">
        <CardContent className="pt-4 pb-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <ShoppingCart className="size-3.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">成交订单数</p>
            </div>
            <p className="text-sm font-bold tabular-nums shrink-0">{orderCount}</p>
          </div>
          <p className="text-xs text-muted-foreground pl-5">已完成订单</p>
        </CardContent>
      </Card>

      {/* 累计团队奖金 */}
      <Card className="py-0">
        <CardContent className="pt-4 pb-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Users className="size-3.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">累计团队奖金</p>
            </div>
            <p className="text-sm font-bold tabular-nums shrink-0">
              ¥{level2CommissionTotal.toFixed(2)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground pl-5">
            团队销售分润 · {inviteeCount} 人团队
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
