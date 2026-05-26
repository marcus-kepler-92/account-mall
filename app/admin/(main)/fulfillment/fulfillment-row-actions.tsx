"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime } from "@/lib/utils"
import type { FulfillmentRow } from "./fulfillment-columns"
import { useInvalidateAdminNotifications } from "@/app/admin/hooks/use-admin-notifications"

type Props = {
    order: FulfillmentRow
}

/**
 * Row-level actions for the manual-fulfillment center. Three exclusive
 * states by order.status:
 *   AWAITING_FULFILLMENT → 接单 + 发货（Dialog）
 *   PROCESSING           → 发货（Dialog）
 *   COMPLETED / CLOSED   → 查看详情（read-only)
 *
 * The fulfill UI used to be an inline TableRow expansion; switching to
 * a Dialog matches the project-wide convention (see admin-crud-page
 * skill: non-destructive row mutations use Dialog) and avoids hand-
 * rolled row-state plumbing inside the DataTable.
 */
export function FulfillmentRowActions({ order }: Props) {
    const router = useRouter()
    const invalidateNotifications = useInvalidateAdminNotifications()
    const [takingOrder, setTakingOrder] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)

    if (order.status === "COMPLETED" || order.status === "CLOSED") {
        return (
            <Button asChild variant="ghost" size="sm">
                <Link href={`/admin/orders/${order.id}`}>查看详情</Link>
            </Button>
        )
    }

    const take = async () => {
        setTakingOrder(true)
        try {
            const res = await fetch(`/api/admin/orders/${order.id}/take`, {
                method: "POST",
            })
            if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                toast.error(j?.error ?? "接单失败")
                return
            }
            toast.success("已接单")
            router.refresh()
            invalidateNotifications()
        } finally {
            setTakingOrder(false)
        }
    }

    return (
        <>
            <div className="flex items-center justify-end gap-2">
                {order.status === "AWAITING_FULFILLMENT" && (
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={takingOrder}
                        onClick={take}
                    >
                        {takingOrder && <Loader2 className="mr-1 size-3 animate-spin" />}
                        接单
                    </Button>
                )}
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                    发货
                </Button>
            </div>
            <FulfillmentDialog
                order={order}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
            />
        </>
    )
}

type DialogProps = {
    order: FulfillmentRow
    open: boolean
    onOpenChange: (open: boolean) => void
}

function FulfillmentDialog({ order, open, onOpenChange }: DialogProps) {
    const router = useRouter()
    const invalidateNotifications = useInvalidateAdminNotifications()
    const [content, setContent] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const submit = async () => {
        if (content.trim().length === 0) {
            toast.error("请填写发货内容")
            return
        }
        setSubmitting(true)
        try {
            const res = await fetch(`/api/admin/orders/${order.id}/fulfill`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
            })
            if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                toast.error(j?.error ?? "发货失败")
                return
            }
            toast.success("已发货")
            setContent("")
            onOpenChange(false)
            router.refresh()
            invalidateNotifications()
        } finally {
            setSubmitting(false)
        }
    }

    const dunNote =
        order.dunCount > 0
            ? `买家催发货 ${order.dunCount} 次${
                  order.lastDunAt ? `（最近 ${formatDateTime(order.lastDunAt)}）` : ""
              }`
            : null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>发货 · {order.orderNo}</DialogTitle>
                    <DialogDescription>
                        {order.productName}
                        {order.variantName ? ` · ${order.variantName}` : ""}
                    </DialogDescription>
                </DialogHeader>
                {dunNote && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                        {dunNote}
                    </div>
                )}
                <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    maxLength={5000}
                    placeholder="账号 / 卡密 / 网盘链接等发货内容；最多 5000 字"
                />
                <div className="text-xs text-muted-foreground">{content.length} / 5000</div>
                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                    >
                        取消
                    </Button>
                    <Button
                        onClick={submit}
                        disabled={submitting || content.trim().length === 0}
                    >
                        {submitting && <Loader2 className="mr-1 size-3 animate-spin" />}
                        确认发货
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
