"use client"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import {
    getOrderHistory,
    removeOrderFromHistory,
    type OrderHistoryItem,
} from "@/lib/order-history-storage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

/** URL 为选中订单单一数据源；用户点击列表时写回 URL（router.replace），保证预填与点击一致。 */
function MyOrdersPageContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const orderNoFromUrl = searchParams.get("orderNo")

    const [orders, setOrders] = useState<OrderHistoryItem[]>(() => getOrderHistory())
    const [userSelectedOrderNo, setUserSelectedOrderNo] = useState<string | null>(null)
    const [confirmRemoveOrderNo, setConfirmRemoveOrderNo] = useState<string | null>(null)

    const refreshOrders = () => setOrders(getOrderHistory())

    // URL 预填的 orderNo 若不在当前列表中则回退，避免选中“空”
    const orderNoInList = orderNoFromUrl && orders.some((o) => o.orderNo === orderNoFromUrl) ? orderNoFromUrl : null
    const selectedOrderNo = orderNoInList ?? userSelectedOrderNo ?? orders[0]?.orderNo ?? null
    const selected = orders.find((o) => o.orderNo === selectedOrderNo)

    const syncUrlToOrderNo = (orderNo: string | null) => {
        if (orderNo) {
            router.replace(`${pathname}?orderNo=${encodeURIComponent(orderNo)}`, { scroll: false })
        } else {
            router.replace(pathname, { scroll: false })
        }
    }

    const handleRemoveOrderClick = (orderNo: string, e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setConfirmRemoveOrderNo(orderNo)
    }

    const handleConfirmRemoveOrder = () => {
        const orderNo = confirmRemoveOrderNo
        setConfirmRemoveOrderNo(null)
        if (!orderNo) return
        removeOrderFromHistory(orderNo)
        refreshOrders()
        if (selectedOrderNo === orderNo) {
            const rest = orders.filter((o) => o.orderNo !== orderNo)
            const nextOrderNo = rest[0]?.orderNo ?? null
            setUserSelectedOrderNo(nextOrderNo)
            syncUrlToOrderNo(nextOrderNo)
        }
        toast.success("已从列表移除")
    }

    return (
        <div className="flex min-h-screen flex-col">
            <AlertDialog open={confirmRemoveOrderNo !== null} onOpenChange={(open) => !open && setConfirmRemoveOrderNo(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>从列表移除订单</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定从列表中移除该订单记录？仅清除本机记录，不影响订单本身。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmRemoveOrder}>
                            确定移除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <SiteHeader />

            <main className="flex-1 overflow-x-hidden px-4 py-8 sm:px-6">
                <div className="mx-auto min-w-0 max-w-4xl">
                    <h1 className="mb-8 text-2xl font-semibold tracking-tight">我的订单</h1>

                    {orders.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-16">
                                <Package className="size-12 text-muted-foreground" />
                                <p className="mt-4 text-sm text-muted-foreground">
                                    暂无订单记录，下单后将显示在此
                                </p>
                                <Button asChild className="mt-5">
                                    <Link href="/">去逛逛</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid min-w-0 gap-6 md:grid-cols-[280px_1fr]">
                            {/* 订单列表：仅标题，不用 CardHeader 的 grid，避免与默认样式冲突 */}
                            <Card className="min-w-0">
                                <div className="px-4 pt-4 pb-3 sm:px-5">
                                    <h2 className="text-base font-semibold leading-none">订单列表</h2>
                                </div>
                                <CardContent className="p-0">
                                    <ul className="max-h-[360px] overflow-y-auto">
                                        {orders.map((o) => (
                                            <li key={o.orderNo} className="border-b last:border-b-0">
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => {
                                                        setUserSelectedOrderNo(o.orderNo)
                                                        syncUrlToOrderNo(o.orderNo)
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault()
                                                            setUserSelectedOrderNo(o.orderNo)
                                                            syncUrlToOrderNo(o.orderNo)
                                                        }
                                                    }}
                                                    className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left hover:bg-accent/50 sm:px-5 ${
                                                        selectedOrderNo === o.orderNo ? "bg-accent" : ""
                                                    }`}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="flex items-baseline justify-between gap-2 text-sm">
                                                            <span
                                                                className="min-w-0 truncate font-mono text-[13px] text-foreground"
                                                                title={o.orderNo}
                                                            >
                                                                {o.orderNo}
                                                            </span>
                                                            <span className="shrink-0 font-semibold tabular-nums">
                                                                ¥{formatAmount(o.amount)}
                                                            </span>
                                                        </p>
                                                        <p className="mt-1.5 flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
                                                            <span className="min-w-0 truncate" title={o.productName}>{o.productName}</span>
                                                            <span className="shrink-0">{formatDateShort(o.createdAt)}</span>
                                                        </p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                                        onClick={(e) => handleRemoveOrderClick(o.orderNo, e)}
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
                            <Card className="min-w-0">
                                <CardHeader className="min-w-0 overflow-hidden px-4 sm:px-6">
                                    <CardTitle className="flex min-w-0 items-center gap-2 text-base font-semibold">
                                        <Package className="size-5 shrink-0" />
                                        <span
                                            className="min-w-0 truncate"
                                            title={selected ? `${selected.productName} · ${selected.orderNo}` : undefined}
                                        >
                                            {selected
                                                ? `${selected.productName} · ${selected.orderNo}`
                                                : "订单详情"}
                                        </span>
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        {selected
                                            ? "本地历史记录，点击下方按钮跳转订单查询（输入密码查看卡密）"
                                            : "在左侧选择订单"}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5 px-4 sm:px-6">
                                    {selected ? (
                                        <>
                                            <dl className="grid gap-3.5 text-sm">
                                                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                                                    <dt className="shrink-0 text-muted-foreground">订单号</dt>
                                                    <dd className="min-w-0 truncate font-mono" title={selected.orderNo}>{selected.orderNo}</dd>
                                                </div>
                                                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                                                    <dt className="shrink-0 text-muted-foreground">商品</dt>
                                                    <dd className="min-w-0 truncate" title={selected.productName}>{selected.productName}</dd>
                                                </div>
                                                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                                                    <dt className="shrink-0 text-muted-foreground">金额</dt>
                                                    <dd className="font-medium tabular-nums">¥{formatAmount(selected.amount)}</dd>
                                                </div>
                                                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                                                    <dt className="shrink-0 text-muted-foreground">创建时间</dt>
                                                    <dd>{formatDate(selected.createdAt)}</dd>
                                                </div>
                                            </dl>
                                            <Button asChild className="mt-1 w-full gap-2">
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
