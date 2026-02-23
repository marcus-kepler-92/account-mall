"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
    getOrderHistory,
    removeOrderFromHistory,
    type OrderHistoryItem,
} from "@/lib/order-history-storage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Search, Trash2 } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { toast } from "sonner"

function formatDate(s: string) {
    try {
        return new Date(s).toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
    } catch {
        return s
    }
}

function formatDateShort(s: string) {
    try {
        return new Date(s).toLocaleString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
    } catch {
        return ""
    }
}

function formatAmount(amount: unknown): string {
    if (typeof amount === "number" && !Number.isNaN(amount)) return amount.toFixed(2)
    return "—"
}

function MyOrdersPageContent() {
    const searchParams = useSearchParams()
    const orderNoFromUrl = searchParams.get("orderNo")

    const [orders, setOrders] = useState<OrderHistoryItem[]>([])
    const [selectedOrderNo, setSelectedOrderNo] = useState<string | null>(null)

    const refreshOrders = () => setOrders(getOrderHistory())

    useEffect(() => {
        refreshOrders()
    }, [])

    useEffect(() => {
        if (orderNoFromUrl) setSelectedOrderNo(orderNoFromUrl)
        else if (orders.length > 0 && !selectedOrderNo) setSelectedOrderNo(orders[0].orderNo)
    }, [orderNoFromUrl, orders, selectedOrderNo])

    const selected = orders.find((o) => o.orderNo === selectedOrderNo)

    const handleRemoveOrder = (orderNo: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!window.confirm("确定从列表中移除该订单记录？仅清除本机记录，不影响订单本身。")) return
        removeOrderFromHistory(orderNo)
        refreshOrders()
        if (selectedOrderNo === orderNo) {
            const rest = orders.filter((o) => o.orderNo !== orderNo)
            setSelectedOrderNo(rest[0]?.orderNo ?? null)
        }
        toast.success("已从列表移除")
    }

    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />

            <main className="flex-1 px-4 py-6">
                <div className="mx-auto max-w-4xl">
                    <h1 className="mb-6 text-xl font-semibold">我的订单</h1>

                    {orders.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Package className="size-12 text-muted-foreground" />
                                <p className="mt-3 text-sm text-muted-foreground">
                                    暂无订单记录，下单后将显示在此
                                </p>
                                <Button asChild className="mt-4">
                                    <Link href="/">去逛逛</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
                            {/* 订单列表 */}
                            <Card>
                                <CardHeader className="py-3">
                                    <CardTitle className="text-sm">订单列表</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ul className="max-h-[360px] overflow-y-auto">
                                        {orders.map((o) => (
                                            <li key={o.orderNo} className="border-b last:border-b-0">
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => setSelectedOrderNo(o.orderNo)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault()
                                                            setSelectedOrderNo(o.orderNo)
                                                        }
                                                    }}
                                                    className={`flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm hover:bg-accent/50 ${
                                                        selectedOrderNo === o.orderNo ? "bg-accent" : ""
                                                    }`}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="flex items-baseline justify-between gap-2">
                                                            <span
                                                                className="min-w-0 truncate font-mono text-xs text-foreground"
                                                                title={o.orderNo}
                                                            >
                                                                {o.orderNo}
                                                            </span>
                                                            <span className="shrink-0 font-medium tabular-nums">
                                                                ¥{formatAmount(o.amount)}
                                                            </span>
                                                        </p>
                                                        <p className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                                            <span className="min-w-0 truncate">{o.productName}</span>
                                                            <span className="shrink-0">{formatDateShort(o.createdAt)}</span>
                                                        </p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                                        onClick={(e) => handleRemoveOrder(o.orderNo, e)}
                                                        title="从列表移除"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>

                            {/* 订单详情 */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Package className="size-5 shrink-0" />
                                        <span className="min-w-0 truncate">
                                            {selected
                                                ? `${selected.productName} · ${selected.orderNo}`
                                                : "订单详情"}
                                        </span>
                                    </CardTitle>
                                    <CardDescription>
                                        {selected
                                            ? "本地历史记录，点击下方按钮跳转订单查询（输入密码查看卡密）"
                                            : "在左侧选择订单"}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {selected ? (
                                        <>
                                            <dl className="grid gap-2 text-sm">
                                                <div className="flex justify-between gap-4">
                                                    <dt className="text-muted-foreground">订单号</dt>
                                                    <dd className="font-mono">{selected.orderNo}</dd>
                                                </div>
                                                <div className="flex justify-between gap-4">
                                                    <dt className="text-muted-foreground">商品</dt>
                                                    <dd>{selected.productName}</dd>
                                                </div>
                                                <div className="flex justify-between gap-4">
                                                    <dt className="text-muted-foreground">金额</dt>
                                                    <dd>¥{formatAmount(selected.amount)}</dd>
                                                </div>
                                                <div className="flex justify-between gap-4">
                                                    <dt className="text-muted-foreground">创建时间</dt>
                                                    <dd>{formatDate(selected.createdAt)}</dd>
                                                </div>
                                            </dl>
                                            <Button asChild className="w-full gap-2">
                                                <Link href={`/orders/lookup?orderNo=${encodeURIComponent(selected.orderNo)}`}>
                                                    <Search className="size-4" />
                                                    去订单查询
                                                </Link>
                                            </Button>
                                        </>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            请从左侧选择订单
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

export default function MyOrdersPage() {
    return (
        <Suspense fallback={<div className="min-h-screen" />}>
            <MyOrdersPageContent />
        </Suspense>
    )
}
