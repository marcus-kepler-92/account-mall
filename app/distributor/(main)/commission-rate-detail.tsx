"use client"

import { Info } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface CommissionRateDetailProps {
    myRate: number
    tierRate: number
    level2Rate: number
    hasInviter: boolean
}

export function CommissionRateDetail({ myRate, tierRate, level2Rate, hasInviter }: CommissionRateDetailProps) {
    return (
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground mb-1">您的实际佣金比例</p>
            <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold tabular-nums">{myRate}%</p>
                {hasInviter && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                                <Info className="size-4" />
                                <span className="sr-only">查看计算明细</span>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent side="bottom" align="start" className="text-sm w-auto">
                            <p>当前档位佣金 {tierRate}% − 推荐人奖励 {level2Rate}% = 您实得 {myRate}%</p>
                        </PopoverContent>
                    </Popover>
                )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
                每 ¥100 销售额到手 ¥{(100 * myRate / 100).toFixed(2)}
            </p>
        </div>
    )
}
