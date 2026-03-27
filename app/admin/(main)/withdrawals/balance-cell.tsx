"use client"

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import type { WithdrawalRow } from "./withdrawals-columns"

export function BalanceCell({ row }: { row: WithdrawalRow }) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="cursor-default tabular-nums underline decoration-dashed underline-offset-2">
                        ¥{row.currentBalance.toFixed(2)}
                    </span>
                </TooltipTrigger>
                <TooltipContent className="w-56 text-xs space-y-1 p-3">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">一级佣金（已结算）</span>
                        <span>¥{row.level1Settled.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">二级佣金（已结算）</span>
                        <span>¥{row.level2Settled.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between">
                        <span className="text-muted-foreground">已打款</span>
                        <span>-¥{row.paidTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">提现中</span>
                        <span>-¥{row.pendingTotal.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-medium">
                        <span>可提现余额</span>
                        <span>¥{row.currentBalance.toFixed(2)}</span>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
