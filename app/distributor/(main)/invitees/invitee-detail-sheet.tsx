"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { TierProgress } from "@/app/distributor/(main)/tier-progress"
import type { InviteeRow } from "./invitees-columns"

interface InviteeDetailSheetProps {
  row: InviteeRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteeDetailSheet({ row, open, onOpenChange }: InviteeDetailSheetProps) {
  if (!row) return null

  const active = row.weeklySalesTotal > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-md">
        <SheetHeader className="border-b pb-4 shrink-0">
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            {row.name}
            <Badge variant={active ? "default" : "secondary"} className="text-xs">
              {active ? "本周活跃" : "本周未活跃"}
            </Badge>
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {row.email ?? row.username ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            加入于 {new Date(row.createdAt).toLocaleDateString("zh-CN")}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h4 className="text-sm font-medium mb-3">本周阶梯</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">当前档位</span>
                <span>{row.tierLabel ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">本周销售额</span>
                <span className="tabular-nums font-medium">¥{row.weeklySalesTotal.toFixed(2)}</span>
              </div>
              {row.nextTierMinAmount !== null && (
                <TierProgress
                  weeklySalesTotal={row.weeklySalesTotal}
                  nextTierMinAmount={row.nextTierMinAmount}
                />
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-3">业绩</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">累计销售额</p>
                <p className="text-lg font-bold tabular-nums">¥{row.salesTotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">成交订单</p>
                <p className="text-lg font-bold">{row.completedOrderCount} 单</p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-3">为我贡献</h4>
            <p className="text-xs text-muted-foreground">累计团队奖金</p>
            <p className="text-lg font-bold tabular-nums">¥{row.level2CommissionTotal.toFixed(2)}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
