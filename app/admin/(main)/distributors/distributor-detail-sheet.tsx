"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Copy, UserCheck, UserX, Percent, Trash2, Loader2 } from "lucide-react"
import {
    Sheet,
    SheetContent,
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
import { Separator } from "@/components/ui/separator"
import { EditDiscountDialog } from "./edit-discount-dialog"
import type { DistributorRow } from "./distributors-columns"
import type { TierSummaryItem } from "@/lib/distributor-tier-summary"

interface DistributorDetailSheetProps {
    row: DistributorRow | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    tiers: TierSummaryItem[]
}

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
                <SheetContent className="flex flex-col w-full sm:max-w-md">
                    <SheetHeader className="border-b pb-4 shrink-0">
                        <SheetTitle className="flex items-center gap-2 flex-wrap">
                            {row.name}
                            <Badge variant={disabled ? "destructive" : "default"} className="text-xs">
                                {disabled ? "已停用" : "启用"}
                            </Badge>
                        </SheetTitle>
                        <p className="text-sm text-muted-foreground">{row.email ?? row.username ?? "—"}</p>
                        {row.distributorCode && (
                            <div className="flex items-center gap-2">
                                <code className="text-xs font-mono">{row.distributorCode}</code>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={handleCopyCode}
                                >
                                    <Copy className="size-3 mr-1" />复制
                                </Button>
                            </div>
                        )}
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleToggle}
                                disabled={toggleLoading}
                            >
                                {toggleLoading
                                    ? <Loader2 className="size-4 animate-spin" />
                                    : disabled
                                        ? <UserCheck className="size-4" />
                                        : <UserX className="size-4" />
                                }
                                {disabled ? "启用" : "停用"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setDiscountOpen(true)}>
                                <Percent className="size-4" />优惠码设置
                            </Button>
                            {disabled && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                                    onClick={() => setDeleteOpen(true)}
                                >
                                    <Trash2 className="size-4" />删除
                                </Button>
                            )}
                        </div>

                        <Separator />

                        {/* 阶梯 */}
                        {tiers.length > 0 && (() => {
                            const result = getCurrentTier(row.weeklySalesTotal, tiers)
                            const nextTier = result ? tiers[result.index + 1] : null
                            return (
                                <div>
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
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">距下一档</span>
                                                <span className="tabular-nums text-muted-foreground">
                                                    ¥{(nextTier.minAmount - row.weeklySalesTotal).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })()}

                        <Separator />

                        {/* 业绩 */}
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

                        {/* 佣金 */}
                        <div>
                            <h4 className="text-sm font-medium mb-3">佣金</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">累计佣金</span>
                                    <span className="font-medium tabular-nums">¥{row.totalCommission.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">一级佣金</span>
                                    <span className="tabular-nums">¥{row.level1CommissionTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">二级佣金</span>
                                    <span className="tabular-nums">¥{row.level2CommissionTotal.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* 余额 */}
                        <div>
                            <h4 className="text-sm font-medium mb-3">余额</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">可提现余额</span>
                                    <span className="font-medium tabular-nums">¥{row.withdrawableBalance.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">已结算（一级）</span>
                                    <span className="tabular-nums">¥{row.level1Settled.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">已结算（二级）</span>
                                    <span className="tabular-nums">¥{row.level2Settled.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">已打款</span>
                                    <span className="tabular-nums">¥{row.paidTotal.toFixed(2)}</span>
                                </div>
                                {row.pendingTotal > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">提现中</span>
                                        <span className="tabular-nums">¥{row.pendingTotal.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* 团队 */}
                        <div>
                            <h4 className="text-sm font-medium mb-3">团队</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">上线</span>
                                    <span>
                                        {row.inviter
                                            ? `${row.inviter.name}${row.inviter.distributorCode ? ` (${row.inviter.distributorCode})` : ""}`
                                            : "—"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">下线人数</span>
                                    <span>{row.inviteeCount} 人</span>
                                </div>
                                {row.invitees.length > 0 && (
                                    <div className="pt-1 space-y-1">
                                        {row.invitees.map((inv) => (
                                            <div key={inv.id} className="flex justify-between text-xs text-muted-foreground">
                                                <span>{inv.name}</span>
                                                {inv.distributorCode && (
                                                    <code className="font-mono">{inv.distributorCode}</code>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* 优惠码 */}
                        <div>
                            <h4 className="text-sm font-medium mb-3">优惠码</h4>
                            <p className="text-sm">
                                {row.discountCodeEnabled
                                    ? row.discountPercent != null
                                        ? `已启用 · ${row.discountPercent}% 折扣`
                                        : "已启用"
                                    : "未开启"}
                            </p>
                        </div>
                    </div>
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
