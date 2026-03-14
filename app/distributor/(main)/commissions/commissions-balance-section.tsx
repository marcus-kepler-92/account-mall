import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApplyWithdrawalForm } from "./apply-withdrawal-form";

interface CommissionsBalanceSectionProps {
  level1Settled: number;
  level2Settled: number;
  paidTotal: number;
  pendingTotal: number;
  withdrawableBalance: number;
  inviteeCount: number;
  minAmount: number;
  feePercent?: number;
}

export function CommissionsBalanceSection({
  level1Settled,
  level2Settled,
  paidTotal,
  pendingTotal,
  withdrawableBalance,
  inviteeCount,
  minAmount,
  feePercent = 0,
}: CommissionsBalanceSectionProps) {
  const descriptionParts: string[] = [
    `一级佣金（已结算）¥${level1Settled.toFixed(2)}`,
    `二级佣金（已结算）¥${level2Settled.toFixed(2)}`,
    `已打款 ¥${paidTotal.toFixed(2)}`,
    `提现中 ¥${pendingTotal.toFixed(2)}`,
  ];
  if (feePercent > 0) {
    descriptionParts.push(`提现手续费 ${feePercent}%`);
  }

  return (
    <>
      {/* 可提现余额卡片 */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>可提现余额</CardTitle>
            <CardDescription>
              {descriptionParts.join(" · ")} = 可提现余额；申请提现后由管理员线下打款
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="min-h-9 touch-manipulation" asChild>
            <Link href="/distributor/withdrawals">查看提现记录</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-3xl font-bold">¥{withdrawableBalance.toFixed(2)}</p>
          {pendingTotal > 0 && (
            <p className="text-sm text-muted-foreground">
              提现中：¥{pendingTotal.toFixed(2)}（处理中，到账后余额将更新）
            </p>
          )}
          <ApplyWithdrawalForm
            withdrawableBalance={withdrawableBalance}
            pendingWithdrawalTotal={pendingTotal}
            minAmount={minAmount}
            feePercent={feePercent}
          />
        </CardContent>
      </Card>

      {/* 二级佣金汇总卡片 */}
      {(level2Settled > 0 || inviteeCount > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>二级佣金收益（下线推广所得）</CardTitle>
            <CardDescription>
              下线每笔成交，您自动获得对应金额的二级佣金
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">累计二级佣金</p>
                <p className="text-2xl font-bold">¥{level2Settled.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">参与下线数量</p>
                <p className="text-2xl font-bold">{inviteeCount} 人</p>
              </div>
            </div>
            <Button variant="link" className="h-auto p-0 text-sm" asChild>
              <Link href="/distributor/invitees">查看我的下线 →</Link>
            </Button>
          </CardContent>
        </Card>
      )}

    </>
  );
}
