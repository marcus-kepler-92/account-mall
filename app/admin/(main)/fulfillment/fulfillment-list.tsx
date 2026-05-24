"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Bell, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import type { FulfillmentStatusFilter } from "./fulfillment-filters"

export type FulfillmentRow = {
    id: string
    orderNo: string
    email: string
    productName: string
    variantName: string | null
    quantity: number
    amount: number
    status:
        | "AWAITING_FULFILLMENT"
        | "PROCESSING"
        | "COMPLETED"
        | "CLOSED"
    dunCount: number
    lastDunAt: string | null
    createdAt: string
}

interface FulfillmentListProps {
    orders: FulfillmentRow[]
    currentStatus: FulfillmentStatusFilter
    dunnedOnly: boolean
}

const STATUS_LABELS: Array<{ value: FulfillmentStatusFilter; label: string }> = [
    { value: "in_progress", label: "未发货" },
    { value: "awaiting", label: "待接单" },
    { value: "processing", label: "处理中" },
    { value: "completed", label: "已完成" },
    { value: "closed", label: "已关闭" },
    { value: "all", label: "全部" },
]

const STATUS_BADGE: Record<
    FulfillmentRow["status"],
    { label: string; variant: "warning" | "success" | "secondary" }
> = {
    AWAITING_FULFILLMENT: { label: "待接单", variant: "warning" },
    PROCESSING: { label: "处理中", variant: "warning" },
    COMPLETED: { label: "已完成", variant: "success" },
    CLOSED: { label: "已关闭", variant: "secondary" },
}

function formatWaitingDuration(iso: string): string {
    const start = new Date(iso).getTime()
    if (Number.isNaN(start)) return "—"
    const diffMs = Date.now() - start
    if (diffMs <= 0) return "刚刚"
    const minutes = Math.floor(diffMs / 60_000)
    if (minutes < 60) return `${minutes} 分钟`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} 小时`
    const days = Math.floor(hours / 24)
    const remHours = hours % 24
    return remHours > 0 ? `${days} 天 ${remHours} 小时` : `${days} 天`
}

export function FulfillmentList({ orders, currentStatus, dunnedOnly }: FulfillmentListProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()
    const [openRowId, setOpenRowId] = useState<string | null>(null)

    const updateQuery = useCallback(
        (patch: Record<string, string | null>) => {
            const params = new URLSearchParams(searchParams.toString())
            for (const [key, value] of Object.entries(patch)) {
                if (value === null || value === "") {
                    params.delete(key)
                } else {
                    params.set(key, value)
                }
            }
            const query = params.toString()
            startTransition(() => {
                router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
            })
        },
        [pathname, router, searchParams],
    )

    const onStatusChange = (next: string) => {
        updateQuery({ status: next === "in_progress" ? null : next })
    }
    const onDunnedToggle = (checked: boolean) => {
        updateQuery({ dunnedOnly: checked ? "true" : null })
    }

    const toggleRow = (id: string) => {
        setOpenRowId((prev) => (prev === id ? null : id))
    }

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-base">待处理订单</CardTitle>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Label className="text-sm text-muted-foreground">状态</Label>
                            <Select value={currentStatus} onValueChange={onStatusChange}>
                                <SelectTrigger className="h-8 w-[140px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_LABELS.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={dunnedOnly}
                                onCheckedChange={(v) => onDunnedToggle(Boolean(v))}
                            />
                            <span>仅看被催</span>
                        </label>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <div
                    className={
                        isPending
                            ? "opacity-50 pointer-events-none transition-opacity"
                            : "transition-opacity"
                    }
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>订单号</TableHead>
                                <TableHead>商品 / SKU</TableHead>
                                <TableHead>买家</TableHead>
                                <TableHead className="text-right">金额</TableHead>
                                <TableHead>等待时长</TableHead>
                                <TableHead className="text-right">催</TableHead>
                                <TableHead>状态</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                        暂无订单
                                    </TableCell>
                                </TableRow>
                            ) : (
                                orders.map((order) => (
                                    <FulfillmentRowView
                                        key={order.id}
                                        order={order}
                                        open={openRowId === order.id}
                                        onToggle={() => toggleRow(order.id)}
                                        onClose={() => setOpenRowId(null)}
                                    />
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}

interface RowViewProps {
    order: FulfillmentRow
    open: boolean
    onToggle: () => void
    onClose: () => void
}

function FulfillmentRowView({ order, open, onToggle, onClose }: RowViewProps) {
    const badge = STATUS_BADGE[order.status]
    const isInline = order.status === "AWAITING_FULFILLMENT" || order.status === "PROCESSING"
    return (
        <>
            <TableRow data-state={open ? "selected" : undefined}>
                <TableCell>
                    <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-xs hover:underline"
                    >
                        {order.orderNo}
                    </Link>
                </TableCell>
                <TableCell>
                    <div className="flex flex-col">
                        <span className="font-medium">{order.productName}</span>
                        {order.variantName && (
                            <span className="text-xs text-muted-foreground">{order.variantName}</span>
                        )}
                    </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{order.email}</TableCell>
                <TableCell className="text-right font-medium">
                    {formatCurrency(order.amount)}
                </TableCell>
                <TableCell className="text-sm">
                    <div className="flex flex-col">
                        <span>{formatWaitingDuration(order.createdAt)}</span>
                        <span className="text-xs text-muted-foreground">
                            {formatDateTime(order.createdAt)}
                        </span>
                    </div>
                </TableCell>
                <TableCell className="text-right">
                    {order.dunCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-destructive">
                            <Bell className="size-3.5" />
                            {order.dunCount}
                        </span>
                    ) : (
                        <span className="text-muted-foreground">—</span>
                    )}
                </TableCell>
                <TableCell>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                </TableCell>
                <TableCell className="text-right">
                    <RowActions order={order} open={open} onToggle={onToggle} />
                </TableCell>
            </TableRow>
            {isInline && open && (
                <TableRow data-state="selected">
                    <TableCell colSpan={8} className="bg-muted/30">
                        <InlineFulfillPanel order={order} onDone={onClose} />
                    </TableCell>
                </TableRow>
            )}
        </>
    )
}

interface RowActionsProps {
    order: FulfillmentRow
    open: boolean
    onToggle: () => void
}

function RowActions({ order, open, onToggle }: RowActionsProps) {
    const router = useRouter()
    const [takingOrder, setTakingOrder] = useState(false)

    if (order.status === "COMPLETED" || order.status === "CLOSED") {
        return (
            <Button asChild variant="outline" size="sm">
                <Link href={`/admin/orders/${order.id}`}>查看详情</Link>
            </Button>
        )
    }

    const take = async () => {
        setTakingOrder(true)
        try {
            const res = await fetch(`/api/admin/orders/${order.id}/take`, { method: "POST" })
            if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                toast.error(j?.error ?? "接单失败")
                return
            }
            toast.success("已接单")
            router.refresh()
        } finally {
            setTakingOrder(false)
        }
    }

    return (
        <div className="flex items-center justify-end gap-2">
            {order.status === "AWAITING_FULFILLMENT" && (
                <Button variant="outline" size="sm" disabled={takingOrder} onClick={take}>
                    {takingOrder && <Loader2 className="mr-1 size-3 animate-spin" />}
                    接单
                </Button>
            )}
            <Button size="sm" variant={open ? "secondary" : "default"} onClick={onToggle}>
                {open ? "收起" : "发货"}
            </Button>
        </div>
    )
}

interface InlinePanelProps {
    order: FulfillmentRow
    onDone: () => void
}

function InlineFulfillPanel({ order, onDone }: InlinePanelProps) {
    const router = useRouter()
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
            onDone()
            router.refresh()
        } finally {
            setSubmitting(false)
        }
    }

    const dunNote = useMemo(() => {
        if (order.dunCount <= 0) return null
        const lastTxt = order.lastDunAt
            ? `（最近 ${formatDateTime(order.lastDunAt)}）`
            : ""
        return `买家催发货 ${order.dunCount} 次${lastTxt}`
    }, [order.dunCount, order.lastDunAt])

    return (
        <div className="space-y-3 py-2">
            {dunNote && (
                <div className="text-sm text-destructive">{dunNote}</div>
            )}
            <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                maxLength={5000}
                placeholder="账号 / 卡密 / 网盘链接等发货内容；最多 5000 字"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{content.length} / 5000</span>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={onDone} disabled={submitting}>
                        取消
                    </Button>
                    <Button
                        size="sm"
                        onClick={submit}
                        disabled={submitting || content.trim().length === 0}
                    >
                        {submitting && <Loader2 className="mr-1 size-3 animate-spin" />}
                        确认发货
                    </Button>
                </div>
            </div>
        </div>
    )
}
