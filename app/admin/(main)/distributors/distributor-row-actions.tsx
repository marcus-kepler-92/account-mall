"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MoreHorizontal, UserCheck, UserX, Copy, KeyRound, Loader2, Percent, Trash2, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { PasswordRevealDialog } from "@/app/admin/components"
import { EditDiscountDialog } from "./edit-discount-dialog"
import type { DistributorViewRow } from "./distributors-columns"

export function BalanceTooltip({ row }: { row: DistributorViewRow }) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="cursor-default underline decoration-dashed underline-offset-2">
                        ¥{row.withdrawableBalance.toFixed(2)}
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
                        <span>¥{row.withdrawableBalance.toFixed(2)}</span>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

export function CommissionTooltip({ row }: { row: DistributorViewRow }) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="cursor-default underline decoration-dashed underline-offset-2">
                        ¥{row.totalCommission.toFixed(2)}
                    </span>
                </TooltipTrigger>
                <TooltipContent className="w-48 text-xs space-y-1 p-3">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">一级佣金</span>
                        <span>¥{row.level1CommissionTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">二级佣金</span>
                        <span>¥{row.level2CommissionTotal.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-medium">
                        <span>合计</span>
                        <span>¥{row.totalCommission.toFixed(2)}</span>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

export function DistributorRowActions({ row }: { row: DistributorViewRow }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [discountOpen, setDiscountOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [resetOpen, setResetOpen] = useState(false)
    const [resetLoading, setResetLoading] = useState(false)
    const [revealPassword, setRevealPassword] = useState<string | null>(null)
    const disabled = !!row.disabledAt

    const handleToggle = async () => {
        setLoading(true)
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
            router.refresh()
        } catch {
            toast.error("操作失败")
        } finally {
            setLoading(false)
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

    const handleResetPassword = async () => {
        setResetLoading(true)
        try {
            const res = await fetch(`/api/admin/distributors/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "resetPassword" }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error ?? "操作失败")
                return
            }
            const data = await res.json()
            setResetOpen(false)
            setRevealPassword(data.password)
        } catch {
            toast.error("操作失败")
        } finally {
            setResetLoading(false)
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
            toast.success("分销员已删除")
            router.refresh()
        } catch {
            toast.error("删除失败")
        } finally {
            setDeleteLoading(false)
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">操作菜单</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                        <Link href={`/admin/distributors/${row.id}`}>
                            <Eye className="size-4" />
                            查看详情
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onSelect={(e) => { e.preventDefault(); handleToggle() }}
                        disabled={loading}
                    >
                        {disabled ? (
                            <>
                                <UserCheck className="size-4" />
                                启用
                            </>
                        ) : (
                            <>
                                <UserX className="size-4" />
                                停用
                            </>
                        )}
                    </DropdownMenuItem>
                    {row.distributorCode && (
                        <DropdownMenuItem onClick={handleCopyCode}>
                            <Copy className="size-4" />
                            复制推荐码
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDiscountOpen(true) }}>
                        <Percent className="size-4" />
                        优惠码设置
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setResetOpen(true) }}>
                        <KeyRound className="size-4" />
                        重置密码
                    </DropdownMenuItem>
                    {disabled && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={(e) => {
                                    e.preventDefault()
                                    setDeleteOpen(true)
                                }}
                            >
                                <Trash2 className="size-4" />
                                删除
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            <EditDiscountDialog
                open={discountOpen}
                onOpenChange={setDiscountOpen}
                distributorId={row.id}
                distributorCode={row.distributorCode}
                discountCodeEnabled={row.discountCodeEnabled}
                discountPercent={row.discountPercent}
                onSuccess={() => router.refresh()}
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
                            onClick={(e) => {
                                e.preventDefault()
                                handleDelete()
                            }}
                            disabled={deleteLoading}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {deleteLoading && <Loader2 className="size-4 animate-spin" />}
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>重置密码</AlertDialogTitle>
                        <AlertDialogDescription>
                            将为该分销员生成一次性临时密码，原密码立即失效，下次登录时需设置新密码。确定继续？
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={resetLoading}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleResetPassword()
                            }}
                            disabled={resetLoading}
                        >
                            {resetLoading && <Loader2 className="size-4 animate-spin" />}
                            重置
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {revealPassword && (
                <PasswordRevealDialog
                    password={revealPassword}
                    open={true}
                    onClose={() => setRevealPassword(null)}
                    description="这是一次性密码，仅显示一次，请转告分销员。分销员下次登录时需要修改密码。"
                />
            )}
        </>
    )
}
