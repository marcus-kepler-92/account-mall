import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Coins, Wallet, Users, Tag } from "lucide-react";
import { CopyButtonClient } from "@/app/components/copy-promo-button";

interface DashboardKpiSectionProps {
  orderCount: number;
  level1CommissionTotal: number;
  level2CommissionTotal: number;
  withdrawableBalance: number;
  pendingWithdrawalTotal: number;
  inviteeCount: number;
  distributorCode: string;
  discountCodeEnabled: boolean;
  discountPercent: number | null;
}

export function DashboardKpiSection({
  orderCount,
  level1CommissionTotal,
  level2CommissionTotal,
  withdrawableBalance,
  pendingWithdrawalTotal,
  inviteeCount,
  distributorCode,
  discountCodeEnabled,
  discountPercent,
}: DashboardKpiSectionProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
      {/* 邀请码 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Tag className="size-4 text-primary" />
              邀请码
            </CardTitle>
            {discountCodeEnabled ? (
              <Badge variant="success" className="w-fit text-xs">
                优惠{discountPercent != null ? ` ${discountPercent}%` : ""}
              </Badge>
            ) : (
              <Badge variant="secondary" className="w-fit text-xs">无优惠</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 justify-between">
            <p className="text-xl font-mono font-bold">{distributorCode}</p>
            <CopyButtonClient
              text={distributorCode}
              label="复制"
              successMessage="邀请码已复制"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
            />
          </div>
          {discountCodeEnabled && discountPercent != null && (
            <p className="text-xs text-muted-foreground mt-1">
              客户下单享 {discountPercent}% 折扣
            </p>
          )}
        </CardContent>
      </Card>

      {/* 可提现余额 */}
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

      {/* 累计推广奖金 */}
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

      {/* 成交订单数 */}
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

      {/* 累计团队奖金 */}
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
