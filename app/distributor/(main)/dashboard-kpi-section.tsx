import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShoppingCart, Coins, Wallet, Users } from "lucide-react";
import { CopyButtonClient } from "@/app/components/copy-promo-button";
import { Badge } from "@/components/ui/badge";

interface DashboardKpiSectionProps {
  orderCount: number;
  level1CommissionTotal: number;
  level2CommissionTotal: number;
  withdrawableBalance: number;
  pendingWithdrawalTotal: number;
  distributorCode: string;
  inviteeCount: number;
  discountCodeEnabled: boolean;
  discountPercent: number | null;
}

export function DashboardKpiSection({
  orderCount,
  level1CommissionTotal,
  level2CommissionTotal,
  withdrawableBalance,
  pendingWithdrawalTotal,
  distributorCode,
  inviteeCount,
  discountCodeEnabled,
  discountPercent,
}: DashboardKpiSectionProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Card>
        <CardHeader className="pb-2 ">
          <div className="flex items-center gap-2 justify-between">
          <CardTitle className="text-sm font-medium">优惠码</CardTitle>
            {discountCodeEnabled ? (
              <Badge variant="success" className="w-fit">
                已启用{discountPercent != null ? ` · ${discountPercent}%` : ""}
              </Badge>
            ) : (
              <Badge variant="secondary" className="w-fit">未开通</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 justify-between">
            <p className="text-xl font-mono font-bold">{distributorCode}</p>
            <CopyButtonClient
              text={distributorCode}
              label="复制"
              successMessage="优惠码已复制"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
            />
          </div>
          {discountCodeEnabled && discountPercent != null && (
            <p className="text-xs text-muted-foreground mt-1">
              客户使用此码下单可享 {discountPercent}% 折扣
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <Wallet className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">可提现余额</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl sm:text-2xl font-bold">
            ¥{withdrawableBalance.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            {pendingWithdrawalTotal > 0
              ? `提现中 ¥${pendingWithdrawalTotal.toFixed(2)}`
              : "可申请提现"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <Coins className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">累计推广奖金</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl sm:text-2xl font-bold">
            ¥{level1CommissionTotal.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">直接销售所得</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <ShoppingCart className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">成交订单数</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl sm:text-2xl font-bold">{orderCount}</p>
          <p className="text-xs text-muted-foreground">已完成订单</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <Users className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">累计团队奖金</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl sm:text-2xl font-bold">
            ¥{level2CommissionTotal.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            团队销售分润 · {inviteeCount} 人团队
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
