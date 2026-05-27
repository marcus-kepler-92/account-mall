"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Copy, UserCheck, UserX, Percent, Trash2, Loader2, ChevronRight, MoreHorizontal } from "lucide-react"
import {
    Sheet,
    SheetContent,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EditDiscountDialog } from "./edit-discount-dialog"
import type { DistributorRow } from "./distributors-columns"
import type { TierSummaryItem } from "@/lib/distributor-tier-summary"

interface DistributorDetailSheetProps {
    row: DistributorRow | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    tiers: TierSummaryItem[]
    onSelectDistributor?: (id: string) => void
    selectLoading?: boolean
}

const INVITEE_PREVIEW_LIMIT = 3

function getCurrentTier(weeklySalesTotal: number, tiers: TierSummaryItem[]): { tier: TierSummaryItem; index: number } | null {
    for (let i = 0; i < tiers.length; i++) {
        const t = tiers[i]
        if (weeklySalesTotal >= t.minAmount && weeklySalesTotal < t.maxAmount) {
            return { tier: t, index: i }
        }
    }
    return tiers.length > 0 ? { tier: tiers[0], index: 0 } : null
}

export function DistributorDetailSheet({
    row,
    open,
    onOpenChange,
    onSuccess,
    tiers,
    onSelectDistributor,
    selectLoading,
}: DistributorDetailSheetProps) {
    const [toggleLoading, setToggleLoading] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [discountOpen, setDiscountOpen] = useState(false)

    if (!row) return null

    const disabled = !!row.disabledAt

    const handleToggle = async () => {
        setToggleLoading(true)
        try {
            const res = await fetch(`/api/admin/distributors/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ disabled: !disabled }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error ?? "操作失败")
                return
            }
            toast.success(disabled ? "已启用" : "已停用")
            onOpenChange(false)
            onSuccess()
        } catch {
            toast.error("操作失败")
        } finally {
            setToggleLoading(false)
        }
    }

    const handleCopyCode = async () => {
        if (!row.distributorCode) return
        try {
            await navigator.clipboard.writeText(row.distributorCode)
            toast.success("已复制推荐码")
        } catch {
            toast.error("复制失败")
        }
    }

    const handleDelete = async () => {
        setDeleteLoading(true)
        try {
            const res = await fetch(`/api/admin/distributors/${row.id}`, { method: "DELETE" })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error ?? "删除失败")
                return
            }
            setDeleteOpen(false)
            onOpenChange(false)
            toast.success("分销员已删除")
            onSuccess()
        } catch {
            toast.error("删除失败")
        } finally {
            setDeleteLoading(false)
        }
    }

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="flex flex-col w-full sm:max-w-md p-0">
                    {selectLoading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                            <Loader2 className="size-6 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    <SheetHeader className="border-b shrink-0 gap-2">
                        <SheetTitle className="flex items-center gap-2 flex-wrap">
                            {row.name}
                            <Badge variant={disabled ? "destructive" : "default"} className="text-xs">
                                {disabled ? "已停用" : "启用"}
                            </Badge>
                        </SheetTitle>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
                            <span className="truncate">{row.email ?? row.username ?? "—"}</span>
                            {row.distributorCode && (
                                <>
                                    <span aria-hidden>·</span>
                                    <code className="text-xs font-mono">{row.distributorCode}</code>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-6"
                                        onClick={handleCopyCode}
                                        title="复制推荐码"
                                    >
                                        <Copy className="size-3" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-7">
                        {/* 阶梯 */}
                        {tiers.length > 0 && (() => {
                            const result = getCurrentTier(row.weeklySalesTotal, tiers)
                            const nextTier = result ? tiers[result.index + 1] : null
                            return (
                                <section>
                                    <h4 className="text-sm font-medium mb-3">本周阶梯</h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">当前档位</span>
                                            <span>
                                                {result
                                                    ? `第 ${result.index + 1} 档 · ${result.tier.ratePercent}%`
                                                    : "—"}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">本周销售额</span>
                                            <span className="tabular-nums">¥{row.weeklySalesTotal.toFixed(2)}</span>
                                        </div>
                                        {nextTier && (
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>距下一档</span>
                                                <span className="tabular-nums">
                                                    ¥{(nextTier.minAmount - row.weeklySalesTotal).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )
                        })()}

                        {/* 业绩 */}
                        <section>
                            <h4 className="text-sm font-medium mb-3">业绩</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">累计销售额</span>
                                    <span className="font-medium tabular-nums">¥{row.salesTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">成交订单</span>
                                    <span className="tabular-nums">{row.completedOrderCount} 单</span>
                                </div>
                            </div>
                        </section>

                        {/* 佣金 */}
                        <section>
                            <h4 className="text-sm font-medium mb-3">佣金</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">累计佣金</span>
                                    <span className="font-medium tabular-nums">¥{row.totalCommission.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>一级佣金</span>
                                    <span className="tabular-nums">¥{row.level1CommissionTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>二级佣金</span>
                                    <span className="tabular-nums">¥{row.level2CommissionTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </section>

                        {/* 余额 */}
                        <section>
                            <h4 className="text-sm font-medium mb-3">余额</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">可提现余额</span>
                                    <span className="font-medium tabular-nums">¥{row.withdrawableBalance.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>已结算（一级）</span>
                                    <span className="tabular-nums">¥{row.level1Settled.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>已结算（二级）</span>
                                    <span className="tabular-nums">¥{row.level2Settled.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>已打款</span>
                                    <span className="tabular-nums">¥{row.paidTotal.toFixed(2)}</span>
                                </div>
                                {row.pendingTotal > 0 && (
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>提现中</span>
                                        <span className="tabular-nums">¥{row.pendingTotal.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* 团队与里程碑 */}
                        <section>
                            <h4 className="text-sm font-medium mb-3">团队与里程碑</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">上线</span>
                                    {row.inviter ? (
                                        onSelectDistributor ? (
                                            <button
                                                type="button"
                                                onClick={() => onSelectDistributor(row.inviter!.id)}
                                                disabled={selectLoading}
                                                className="inline-flex items-center gap-1 hover:underline disabled:opacity-50"
                                            >
                                                {row.inviter.name}
                                                {row.inviter.distributorCode && (
                                                    <code className="text-xs font-mono text-muted-foreground">
                                                        ({row.inviter.distributorCode})
                                                    </code>
                                                )}
                                                <ChevronRight className="size-3 text-muted-foreground" />
                                            </button>
                                        ) : (
                                            <span>
                                                {row.inviter.name}
                                                {row.inviter.distributorCode ? ` (${row.inviter.distributorCode})` : ""}
                                            </span>
                                        )
                                    ) : (
                                        <span>—</span>
                                    )}
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">下线人数</span>
                                    <span>{row.inviteeCount} 人</span>
                                </div>
                                {row.invitees.length > 0 && (
                                    <div className="pl-3 space-y-1 border-l">
                                        {row.invitees.slice(0, INVITEE_PREVIEW_LIMIT).map((inv) => {
                                            const content = (
                                                <>
                                                    <span className="truncate">{inv.name}</span>
                                                    <span className="flex items-center gap-1 shrink-0">
                                                        {inv.distributorCode && (
                                                            <code className="font-mono">{inv.distributorCode}</code>
                                                        )}
                                                        {onSelectDistributor && (
                                                            <ChevronRight className="size-3" />
                                                        )}
                                                    </span>
                                                </>
                                            )
                                            return onSelectDistributor ? (
                                                <button
                                                    key={inv.id}
                                                    type="button"
                                                    onClick={() => onSelectDistributor(inv.id)}
                                                    disabled={selectLoading}
                                                    className="flex w-full justify-between items-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                                                >
                                                    {content}
                                                </button>
                                            ) : (
                                                <div key={inv.id} className="flex justify-between text-xs text-muted-foreground">
                                                    {content}
                                                </div>
                                            )
                                        })}
                                        {row.invitees.length > INVITEE_PREVIEW_LIMIT && (
                                            <Link
                                                href={`/admin/distributors?inviterId=${row.id}`}
                                                className="block text-xs text-primary hover:underline pt-1"
                                                onClick={() => onOpenChange(false)}
                                            >
                                                查看全部 {row.inviteeCount} 个下线 →
                                            </Link>
                                        )}
                                    </div>
                                )}
                                {row.milestoneSummary && (
                                    <div className="pt-2 mt-1 border-t space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">里程碑已触发</span>
                                            <span>{row.milestoneSummary.triggeredCount} 个</span>
                                        </div>
                                        {row.milestoneSummary.nextMilestone ? (
                                            <>
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>下一档目标</span>
                                                    <span>
                                                        {row.milestoneSummary.nextMilestone.thresholdCount} 人各满 ¥{row.milestoneSummary.nextMilestone.thresholdAmount.toFixed(0)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs text-muted-foreground">
                                                    <span>达标奖励</span>
                                                    <span className="tabular-nums">¥{row.milestoneSummary.nextMilestone.bonusAmount.toFixed(0)}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">已完成所有里程碑</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    <SheetFooter className="border-t flex-row items-center gap-2">
                        <Button
                            variant={disabled ? "default" : "outline"}
                            size="sm"
                            onClick={handleToggle}
                            disabled={toggleLoading}
                            className="flex-1"
                        >
                            {toggleLoading
                                ? <Loader2 className="size-4 animate-spin" />
                                : disabled
                                    ? <UserCheck className="size-4" />
                                    : <UserX className="size-4" />
                            }
                            {disabled ? "启用" : "停用"}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="size-9 shrink-0" aria-label="更多操作">
                                    <MoreHorizontal className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onSelect={() => setDiscountOpen(true)} className="flex-col items-start gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <Percent className="size-4" />
                                        优惠码设置
                                    </div>
                                    <span className="text-xs text-muted-foreground pl-6">
                                        {row.discountCodeEnabled
                                            ? row.discountPercent != null
                                                ? `${row.discountPercent}% · 已启用`
                                                : "已启用"
                                            : "未开启"}
                                    </span>
                                </DropdownMenuItem>
                                {disabled && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onSelect={() => setDeleteOpen(true)}
                                            variant="destructive"
                                        >
                                            <Trash2 className="size-4" />
                                            删除
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <EditDiscountDialog
                open={discountOpen}
                onOpenChange={setDiscountOpen}
                distributorId={row.id}
                distributorCode={row.distributorCode}
                discountCodeEnabled={row.discountCodeEnabled}
                discountPercent={row.discountPercent}
                onSuccess={() => {
                    onOpenChange(false)
                    onSuccess()
                }}
            />

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除分销员</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要永久删除该分销员吗？此操作不可恢复。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteLoading}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleDelete() }}
                            disabled={deleteLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteLoading && <Loader2 className="size-4 animate-spin" />}
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
