"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useInvalidateAdminNotifications } from "@/app/admin/hooks/use-admin-notifications"
import { MoreHorizontal, Eye, Copy, XCircle, Trash2, Loader2, RotateCcw } from "lucide-react"
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
import type { OrderRow } from "./orders-columns"

export function OrderRowActions({ order }: { order: OrderRow }) {
    const router = useRouter()
    const invalidateNotifications = useInvalidateAdminNotifications()
    const [closeDialogOpen, setCloseDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [refundDialogOpen, setRefundDialogOpen] = useState(false)
    const [closing, setClosing] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [refunding, setRefunding] = useState(false)

    const handleCopyOrderNo = async () => {
        try {
            await navigator.clipboard.writeText(order.orderNo)
            toast.success("已复制订单号")
        } catch {
            toast.error("复制失败")
        }
    }

    const handleClose = async () => {
        setClosing(true)
        try {
            const res = await fetch("/api/orders/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "CLOSE", orderIds: [order.id] }),
            })
            if (res.ok) {
                setCloseDialogOpen(false)
                toast.success("订单已关闭")
                router.refresh()
                invalidateNotifications()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error ?? "关闭失败")
            }
        } catch {
            toast.error("操作失败")
        } finally {
            setClosing(false)
        }
    }

    const handleDelete = async () => {
        setDeleting(true)
        try {
            const res = await fetch("/api/orders/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "DELETE", orderIds: [order.id] }),
            })
            if (res.ok) {
                setDeleteDialogOpen(false)
                toast.success("订单已删除")
                router.refresh()
                invalidateNotifications()
            } else {
                const data = await res.json().catch(() => ({}))
                toast.error(data?.error ?? "删除失败")
            }
        } catch {
            toast.error("操作失败")
        } finally {
            setDeleting(false)
        }
    }

    const handleRefund = async () => {
        setRefunding(true)
        try {
            const res = await fetch(`/api/admin/orders/${order.id}/refund`, {
                method: "POST",
            })
            if (res.ok) {
                setRefundDialogOpen(false)
                toast.success("退款成功")
                router.refresh()
                invalidateNotifications()
            } else {
                const data = await res.json().catch(() => ({}))
                // Refund errors can carry critical, actionable detail (e.g. money already
                // refunded at the provider but local state failed — admin must record the
                // order number). Keep it on-screen longer so it isn't missed.
                toast.error(data?.error ?? "退款失败", { duration: 10000 })
            }
        } catch {
            toast.error("操作失败")
        } finally {
            setRefunding(false)
        }
    }

    const canClose = order.status === "PENDING"
    const canDelete = order.status === "CLOSED"
    const canRefund = order.status === "COMPLETED"

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
                        <Link href={`/admin/orders/${order.id}`}>
                            <Eye className="size-4" />
                            查看详情
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyOrderNo}>
                        <Copy className="size-4" />
                        复制订单号
                    </DropdownMenuItem>
                    {canClose && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onSelect={(e) => {
                                    e.preventDefault()
                                    setCloseDialogOpen(true)
                                }}
                            >
                                <XCircle className="size-4" />
                                关闭订单
                            </DropdownMenuItem>
                        </>
                    )}
                    {canRefund && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onSelect={(e) => {
                                    e.preventDefault()
                                    setRefundDialogOpen(true)
                                }}
                            >
                                <RotateCcw className="size-4" />
                                退款
                            </DropdownMenuItem>
                        </>
                    )}
                    {canDelete && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={(e) => {
                                    e.preventDefault()
                                    setDeleteDialogOpen(true)
                                }}
                            >
                                <Trash2 className="size-4" />
                                删除
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认关闭订单</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要关闭订单 {order.orderNo} 吗？关闭后订单状态将变为「已关闭」。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={closing}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleClose()
                            }}
                            disabled={closing}
                        >
                            {closing && <Loader2 className="size-4 animate-spin" />}
                            确认关闭
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认退款</AlertDialogTitle>
                        <AlertDialogDescription>
                            将通过z-pay对订单 {order.orderNo} 发起全额退款。成功后订单状态变为「已退款」，本单分销佣金将被撤销，相关里程碑奖金会重新核算。此操作无法撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={refunding}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleRefund()
                            }}
                            disabled={refunding}
                        >
                            {refunding && <Loader2 className="size-4 animate-spin" />}
                            确认退款
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除订单 {order.orderNo} 吗？此操作无法撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                handleDelete()
                            }}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting && <Loader2 className="size-4 animate-spin" />}
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
