"use client"

import Link from "next/link"
import { CheckCircle2, ChevronRight, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useState } from "react"

export interface InviteeProgressItem {
    id: string
    name: string | null
    cumulative: number
    qualified: boolean
}

export interface MilestoneCardProps {
    thresholdCount: number
    thresholdAmount: number
    bonusAmount: number
    triggered: boolean
    triggeredBonus?: {
        countSnapshot: number
        thresholdSnapshot: number
        amount: number
        createdAt: string
    }
    qualifiedCount: number
    /** top min(thresholdCount, total) invitees sorted by cumulative desc */
    topInvitees: InviteeProgressItem[]
    hasInvitees: boolean
}

export function MilestoneCard({
    thresholdCount,
    thresholdAmount,
    bonusAmount,
    triggered,
    triggeredBonus,
    qualifiedCount,
    topInvitees,
    hasInvitees,
}: MilestoneCardProps) {
    const [open, setOpen] = useState(false)

    const progress = thresholdCount > 0 ? Math.min(100, (qualifiedCount / thresholdCount) * 100) : 0

    const displayCount = triggered && triggeredBonus ? triggeredBonus.countSnapshot : thresholdCount
    const displayAmount = triggered && triggeredBonus ? triggeredBonus.thresholdSnapshot : thresholdAmount
    const displayBonus = triggered && triggeredBonus ? triggeredBonus.amount : bonusAmount

    const progressColor = progress >= 80 ? "bg-green-500" : progress >= 40 ? "bg-amber-400" : "bg-primary"

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <Card
                role="button"
                tabIndex={0}
                onClick={() => setOpen(true)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen(true) }}
                className={cn(
                    "cursor-pointer select-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "py-0",
                    triggered
                        ? "border-green-200 dark:border-green-900 hover:border-green-400/60"
                        : "hover:border-primary/40",
                )}
            >
                <CardContent className="pt-4 pb-4">
                    {triggered && triggeredBonus ? (
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium">
                                    {displayCount} 位团队成员各完成 ¥{displayAmount.toFixed(0)} 销售额
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {new Date(triggeredBonus.createdAt).toLocaleDateString("zh-CN")} 触发
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <Badge variant="outline" className="text-green-600 border-green-300">已完成 ✓</Badge>
                                <p className="text-sm font-semibold text-green-600 mt-1">+¥{displayBonus.toFixed(0)}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium">
                                    {displayCount} 位团队成员各完成 ¥{displayAmount.toFixed(0)} 销售额
                                </p>
                                <div className="text-right shrink-0">
                                    <p className="text-xs text-muted-foreground">达成奖励</p>
                                    <p className="text-sm font-bold text-amber-600">¥{displayBonus.toFixed(0)}</p>
                                </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                    className={cn("h-full rounded-full transition-all", progressColor)}
                                    style={{ width: `${progress.toFixed(1)}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                    已达标 {qualifiedCount}/{thresholdCount} 人
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                    查看进度 <ChevronRight className="size-3" />
                                </span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <SheetContent
                side="bottom"
                className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-0 pb-safe"
            >
                <SheetHeader className="px-6 pb-4 border-b">
                    <SheetTitle>
                        {displayCount} 位团队成员各完成 ¥{displayAmount.toFixed(0)} 销售额
                    </SheetTitle>
                    <SheetDescription>
                        达成即得 ¥{displayBonus.toFixed(0)} 邀请奖励
                    </SheetDescription>
                </SheetHeader>

                <div className="px-6 py-5 space-y-5">
                    {triggered && triggeredBonus ? (
                        <TriggeredDetail
                            countSnapshot={triggeredBonus.countSnapshot}
                            amount={triggeredBonus.amount}
                            createdAt={triggeredBonus.createdAt}
                        />
                    ) : (
                        <UntriggeredDetail
                            thresholdCount={thresholdCount}
                            thresholdAmount={thresholdAmount}
                            qualifiedCount={qualifiedCount}
                            progress={progress}
                            topInvitees={topInvitees}
                            hasInvitees={hasInvitees}
                        />
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}

function TriggeredDetail({
    countSnapshot,
    amount,
    createdAt,
}: {
    countSnapshot: number
    amount: number
    createdAt: string
}) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="size-5 shrink-0" />
                <span className="font-medium">里程碑已完成</span>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">触发时间</span>
                    <span>{new Date(createdAt).toLocaleDateString("zh-CN")}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">达标人数</span>
                    <span>{countSnapshot} 人</span>
                </div>
                <div className="flex justify-between font-medium">
                    <span className="text-muted-foreground">获得奖励</span>
                    <span className="text-green-600">+¥{amount.toFixed(0)}</span>
                </div>
            </div>
        </div>
    )
}

function UntriggeredDetail({
    thresholdCount,
    thresholdAmount,
    qualifiedCount,
    progress,
    topInvitees,
    hasInvitees,
}: {
    thresholdCount: number
    thresholdAmount: number
    qualifiedCount: number
    progress: number
    topInvitees: InviteeProgressItem[]
    hasInvitees: boolean
}) {
    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">团队达标进度</span>
                    <span className="font-medium">{qualifiedCount} / {thresholdCount} 人</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${progress.toFixed(1)}%` }}
                    />
                </div>
            </div>

            {!hasInvitees ? (
                <div className="py-6 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">还没有团队成员</p>
                    <Link
                        href="/distributor/invitees"
                        className="text-sm font-medium underline underline-offset-4"
                    >
                        立即邀请分销员 →
                    </Link>
                </div>
            ) : (
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 mb-3">
                        <Users className="size-3.5 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                            最接近目标的 {topInvitees.length} 人
                        </p>
                    </div>

                    <div className="space-y-4">
                        {topInvitees.map(({ id, name, cumulative, qualified }) => {
                            const pct = thresholdAmount > 0
                                ? Math.min(100, (cumulative / thresholdAmount) * 100)
                                : 0
                            return (
                                <div key={id} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className={qualified ? "font-medium" : "text-muted-foreground"}>
                                            {name ?? "未命名"}
                                        </span>
                                        {qualified ? (
                                            <span className="text-xs font-medium text-green-600">已达标 ✓</span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                ¥{cumulative.toFixed(0)}&thinsp;/&thinsp;¥{thresholdAmount.toFixed(0)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-all",
                                                qualified ? "bg-green-500" : "bg-primary",
                                            )}
                                            style={{ width: `${pct.toFixed(1)}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {topInvitees.length < thresholdCount && (
                        <p className="text-xs text-muted-foreground pt-3">
                            还需 {thresholdCount - topInvitees.length} 名成员才能达成里程碑，{" "}
                            <Link href="/distributor/invitees" className="underline underline-offset-2 hover:text-foreground">
                                邀请 →
                            </Link>
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
