"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { SiteHeader } from "@/app/components/site-header"
import { useSiteName } from "@/app/components/site-name-provider"
import { Copy, Check, Eye, EyeOff, Loader2, Mail, Hash, AlertCircle, Package, Search, Zap, CreditCard } from "lucide-react"
import { toast } from "sonner"
import { addOrUpdateOrder } from "@/lib/order-history-storage"
import { type FreeSharedCardPayload, isFreeSharedCard } from "@/lib/free-shared-card"

const LOOKUP_PREFILL_KEY_PREFIX = "lookup_prefill_"

type CardItem = { content: string } | (FreeSharedCardPayload & { content: string })

interface OrderResult {
    orderNo: string
    productName: string
    createdAt: string
    status: "PENDING" | "COMPLETED" | "CLOSED"
    cards: CardItem[]
    isPending?: boolean
    /** 未超时、可继续支付（仅 PENDING 时有意义） */
    canPay?: boolean
    /** 支付截止时间 ISO（仅 PENDING 时可能有） */
    expiresAt?: string
}

interface OrderListItem {
    orderNo: string
    productName: string
    createdAt: string
    status: "PENDING" | "COMPLETED" | "CLOSED"
    quantity: number
    amount: number
}

type LookupMode = "orderNo" | "email"

function OrderLookupPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const siteName = useSiteName()
    const [lookupMode, setLookupMode] = useState<LookupMode>("orderNo")
    const [orderNo, setOrderNo] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<OrderResult | null>(null)
    const [orderList, setOrderList] = useState<OrderListItem[] | null>(null)
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [loadingOrderNo, setLoadingOrderNo] = useState<string | null>(null)
    const [sheetLoading, setSheetLoading] = useState(false)
    const [continuePaymentLoading, setContinuePaymentLoading] = useState(false)
    const passwordInputRef = useRef<HTMLInputElement>(null)
    const prefillAttemptedRef = useRef(false)

    // URL → state：从 searchParams 同步 type 与 orderNo（仅读 URL，不写 URL，无循环风险）
    useEffect(() => {
        const typeParam = searchParams.get("type")
        const orderNoParam = searchParams.get("orderNo")
        setLookupMode(typeParam === "email" ? "email" : "orderNo")
        if (orderNoParam) {
            setOrderNo(orderNoParam)
            setLookupMode("orderNo")
            setTimeout(() => passwordInputRef.current?.focus(), 100)
        }
    }, [searchParams])

    // Pre-query: when orderNo in URL and we have prefill password in sessionStorage, run lookup once then clear
    useEffect(() => {
        const orderNoParam = searchParams.get("orderNo")
        if (!orderNoParam || prefillAttemptedRef.current) return

        const prefillKey = LOOKUP_PREFILL_KEY_PREFIX + orderNoParam
        const prefillPassword = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(prefillKey) : null
        if (!prefillPassword) return

        prefillAttemptedRef.current = true
        setError(null)
        setResult(null)
        setOrderList(null)
        setLoading(true)
        setSheetOpen(true)
        setSheetLoading(true)

        if (searchParams.get("fromPay") === "1") {
            toast.success("支付已完成，正在为您查询订单…")
        }

        fetch("/api/orders/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderNo: orderNoParam.trim(), password: prefillPassword.trim() }),
        })
            .then((res) => {
                if (!res.ok) return res.json().then((data) => Promise.reject(new Error(data?.error ?? "查询失败")))
                return res.json()
            })
            .then((data) => {
                if (data.orders && Array.isArray(data.orders)) {
                    setOrderList(data.orders)
                    toast.success(`找到 ${data.orders.length} 个相关订单`)
                } else if (data?.orderNo) {
                    setResult(data)
                    toast.success("查询成功")
                    addOrUpdateOrder({
                        orderNo: data.orderNo,
                        productName: data.productName ?? "商品",
                        amount: data.amount ?? 0,
                        createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
                        status: data.status ?? "PENDING",
                    })
                    // Prefill 仅为自动填密并查单，不跳转成功页；成功页仅由支付回跳（pay-return）进入
                } else {
                    setError("订单不存在或密码错误")
                }
                sessionStorage.removeItem(prefillKey)
            })
            .catch((err) => {
                setError(err?.message ?? "查询失败，请稍后重试")
                sessionStorage.removeItem(prefillKey)
            })
            .finally(() => {
                setLoading(false)
                setSheetLoading(false)
            })
    }, [searchParams, router])

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        setResult(null)
        setOrderList(null)

        if (lookupMode === "orderNo") {
            if (!orderNo.trim() || !password.trim()) {
                setError("订单号和查询密码不能为空")
                return
            }
        } else {
            if (!email.trim() || !password.trim()) {
                setError("邮箱和查询密码不能为空")
                return
            }
        }

        setLoading(true)

        try {
            const apiEndpoint = lookupMode === "orderNo" ? "/api/orders/lookup" : "/api/orders/lookup-by-email"
            const requestBody =
                lookupMode === "orderNo"
                    ? {
                          orderNo: orderNo.trim(),
                          password: password.trim(),
                      }
                    : {
                          email: email.trim().toLowerCase(),
                          password: password.trim(),
                      }

            const res = await fetch(apiEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            })

            if (!res.ok) {
                let message = "查询失败，请稍后重试"
                try {
                    const data = await res.json()
                    if (data?.error === "Order not found or password incorrect") {
                        message = "订单不存在或密码错误"
                    } else if (data?.error) {
                        message = data.error
                    }
                } catch {
                    // ignore JSON parse errors
                }
                setError(message)
                setLoading(false)
                return
            }

            const data = await res.json()

            // Check if response is a list of orders (multiple matches)
            if (data.orders && Array.isArray(data.orders)) {
                setOrderList(data.orders)
                setLoading(false)
                toast.success(`找到 ${data.orders.length} 个相关订单`)
                return
            }

            // Single order result
            if (!data || !data.orderNo) {
                setError("订单不存在或密码错误")
                setLoading(false)
                return
            }

            setResult(data)
            setSheetOpen(true)
            setLoading(false)
            toast.success("查询成功")
        } catch {
            setError("网络错误，请稍后重试")
            setLoading(false)
        }
    }

    const handleOrderClick = async (clickedOrderNo: string) => {
        setError(null)
        setLoadingOrderNo(clickedOrderNo)
        setSheetLoading(true)
        setSheetOpen(true)
        setResult(null)

        try {
            const res = await fetch("/api/orders/lookup", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    orderNo: clickedOrderNo.trim(),
                    password: password.trim(),
                }),
            })

            if (!res.ok) {
                let message = "查询失败，请稍后重试"
                try {
                    const data = await res.json()
                    if (data?.error === "Order not found or password incorrect") {
                        message = "订单详情获取失败"
                    } else if (data?.error) {
                        message = data.error
                    }
                } catch {
                    // ignore JSON parse errors
                }
                toast.error(message)
                setSheetOpen(false)
                setSheetLoading(false)
                setLoadingOrderNo(null)
                return
            }

            const data = await res.json()

            if (!data || !data.orderNo) {
                toast.error("订单详情获取失败")
                setSheetOpen(false)
                setSheetLoading(false)
                setLoadingOrderNo(null)
                return
            }

            setResult(data)
            if (data?.orderNo) {
                addOrUpdateOrder({
                    orderNo: data.orderNo,
                    productName: data.productName ?? "商品",
                    amount: data.amount ?? 0,
                    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
                    status: data.status ?? "PENDING",
                })
            }
            setSheetLoading(false)
            setLoadingOrderNo(null)
            if (data?.successToken && data?.orderNo) {
                router.replace(
                    `/orders/${encodeURIComponent(data.orderNo)}/success?token=${encodeURIComponent(data.successToken)}`,
                )
            }
        } catch {
            toast.error("网络错误，请稍后重试")
            setSheetOpen(false)
            setSheetLoading(false)
            setLoadingOrderNo(null)
        }
    }

    const copyCard = async (content: string, index: number) => {
        try {
            await navigator.clipboard.writeText(content)
            setCopiedIndex(index)
            toast.success("卡密已复制")
            setTimeout(() => setCopiedIndex(null), 2000)
        } catch {
            toast.error("复制失败，请手动复制")
        }
    }

    const copyAllCards = async () => {
        if (!result || result.cards.length === 0) return

        const lines = result.cards.map((card) =>
            isFreeSharedCard(card)
                ? [
                      `账号: ${card.account}`,
                      `密码: ${card.password}`,
                      `地区: ${card.region}`,
                      ...(card.lastCheckedAt ? [`上次检查: ${card.lastCheckedAt}`] : []),
                      ...(card.installStatus ? [`装好状态: ${card.installStatus}`] : []),
                  ].join("\n")
                : card.content
        )
        const text = lines.join("\n\n")
        try {
            await navigator.clipboard.writeText(text)
            toast.success(`已复制 ${result.cards.length} 条卡密`)
        } catch {
            toast.error("复制失败，请手动复制")
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "COMPLETED":
                return <Badge variant="default">已完成</Badge>
            case "PENDING":
                return <Badge variant="secondary">待支付</Badge>
            case "CLOSED":
                return <Badge variant="outline">已关闭</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    const handleContinuePayment = async () => {
        if (!result || !password.trim() || result.isPending !== true || result.canPay !== true) return
        setContinuePaymentLoading(true)
        try {
            const res = await fetch("/api/orders/get-payment-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderNo: result.orderNo, password: password.trim() }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(data?.error ?? "无法继续支付，请稍后重试")
                return
            }
            if (data?.paymentUrl) {
                window.location.href = data.paymentUrl
                return
            }
            toast.error("获取支付链接失败")
        } catch {
            toast.error("网络错误，请稍后重试")
        } finally {
            setContinuePaymentLoading(false)
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />

            {/* Main content */}
            <main className="flex-1">
                <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle>订单查询</CardTitle>
                            <CardDescription>
                                请输入下单时生成的订单号和查询密码，我们会展示该订单下的卡密内容。
                            </CardDescription>
                            {searchParams.get("fromPay") === "1" && searchParams.get("orderNo") && (
                                <div className="mt-3 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                                    支付已完成！若未自动展示卡密，请输入下方查询密码并点击「查询订单」。
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Error message */}
                            {error && (
                                <div className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                                    <AlertCircle className="size-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Lookup mode selector */}
                            <div className="flex gap-2 rounded-lg border p-1">
                                <Button
                                    type="button"
                                    variant={lookupMode === "orderNo" ? "default" : "ghost"}
                                    size="sm"
                                    className="flex flex-1 gap-2"
                                    onClick={() => {
                                        setLookupMode("orderNo")
                                        setError(null)
                                        setResult(null)
                                        setOrderList(null)
                                    }}
                                >
                                    <Hash className="size-4" />
                                    订单号查询
                                </Button>
                                <Button
                                    type="button"
                                    variant={lookupMode === "email" ? "default" : "ghost"}
                                    size="sm"
                                    className="flex flex-1 gap-2"
                                    onClick={() => {
                                        setLookupMode("email")
                                        setError(null)
                                        setResult(null)
                                        setOrderList(null)
                                    }}
                                >
                                    <Mail className="size-4" />
                                    邮箱查询
                                </Button>
                            </div>

                            {/* Query form */}
                            <form onSubmit={handleSubmit} className="space-y-3">
                                {lookupMode === "orderNo" ? (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium" htmlFor="orderNo">
                                            订单号
                                        </label>
                                        <Input
                                            id="orderNo"
                                            name="orderNo"
                                            placeholder="例如：FAK2024021300001"
                                            value={orderNo}
                                            onChange={(e) => setOrderNo(e.target.value)}
                                            disabled={loading}
                                            required
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium" htmlFor="email">
                                            邮箱地址
                                        </label>
                                        <Input
                                            id="email"
                                            name="email"
                                            type="email"
                                            placeholder="例如：user@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            disabled={loading}
                                            required
                                        />
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium" htmlFor="password">
                                        查询密码
                                    </label>
                                    <div className="relative">
                                        <Input
                                            ref={passwordInputRef}
                                            id="password"
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="下单时设置的查询密码"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            disabled={loading}
                                            required
                                            className="pr-10"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                            onClick={() => setShowPassword((v) => !v)}
                                            tabIndex={-1}
                                            aria-label={showPassword ? "隐藏密码" : "显示密码"}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="size-4 text-muted-foreground" />
                                            ) : (
                                                <Eye className="size-4 text-muted-foreground" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 size-4 animate-spin" />
                                            查询中...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="mr-2 size-4" />
                                            查询订单
                                        </>
                                    )}
                                </Button>
                            </form>

                            {/* Order list */}
                            {orderList && orderList.length > 0 && (
                                <div className="space-y-3 border-t pt-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <h3 className="text-base font-semibold flex items-center gap-2">
                                                <Package className="size-4" />
                                                找到 {orderList.length} 个订单
                                            </h3>
                                            <p className="text-xs text-muted-foreground">按创建时间倒序排列，点击查看详情</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {orderList.map((order) => {
                                            const isLoading = loadingOrderNo === order.orderNo
                                            const isSelected = result?.orderNo === order.orderNo && sheetOpen
                                            return (
                                                <Button
                                                    key={order.orderNo}
                                                    type="button"
                                                    variant="outline"
                                                    className={`w-full h-auto rounded-lg border p-3 text-left transition-all ${
                                                        isSelected
                                                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                            : isLoading
                                                              ? "border-muted bg-muted/50"
                                                              : "bg-card hover:bg-accent hover:border-accent-foreground/20"
                                                    } ${loadingOrderNo && !isLoading ? "opacity-50" : ""}`}
                                                    onClick={() => handleOrderClick(order.orderNo)}
                                                    disabled={!!loadingOrderNo}
                                                >
                                                    <div className="space-y-1.5 w-full">
                                                        <div className="flex items-center gap-2">
                                                            {isLoading ? (
                                                                <Loader2 className="size-3 animate-spin shrink-0" />
                                                            ) : null}
                                                            <span className="font-mono text-xs font-medium truncate flex-1">
                                                                {order.orderNo}
                                                            </span>
                                                            {getStatusBadge(order.status)}
                                                        </div>
                                                        <div className="text-sm font-medium truncate">{order.productName}</div>
                                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                            <span>x{order.quantity}</span>
                                                            <span>¥{order.amount.toFixed(2)}</span>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {formatDate(order.createdAt)}
                                                        </div>
                                                    </div>
                                                </Button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t">
                <div className="mx-auto max-w-6xl px-4 py-8">
                    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                        <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-start">
                            <div className="flex items-center gap-2">
                                <div className="flex size-6 items-center justify-center rounded-md bg-primary">
                                    <Zap className="size-3 text-primary-foreground" />
                                </div>
                                <span className="text-sm font-medium">{siteName}</span>
                            </div>
                            <nav className="flex gap-4 text-sm text-muted-foreground">
                                <Link href="/orders/lookup" className="hover:text-foreground transition-colors">
                                    订单查询
                                </Link>
                            </nav>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            &copy; {new Date().getFullYear()} {siteName} 版权所有
                        </p>
                    </div>
                </div>
            </footer>

            {/* Order Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                    {/* Loading skeleton */}
                    {sheetLoading && (
                        <>
                            <SheetHeader>
                                <SheetTitle>加载中...</SheetTitle>
                                <SheetDescription>正在获取订单详情</SheetDescription>
                            </SheetHeader>
                            <div className="space-y-4 px-4 pb-4">
                                <div className="grid gap-2 rounded-lg border bg-muted/50 p-3">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-5 w-20" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Order detail content */}
                    {!sheetLoading && result && (
                        <>
                            <SheetHeader>
                                <div className="flex items-center justify-between pr-6">
                                    <SheetTitle>订单详情</SheetTitle>
                                    {getStatusBadge(result.status)}
                                </div>
                                <SheetDescription className="flex items-center gap-1">
                                    <span className="font-mono text-xs">{result.orderNo}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-5"
                                        onClick={() => {
                                            navigator.clipboard.writeText(result.orderNo)
                                            toast.success("订单号已复制")
                                        }}
                                    >
                                        <Copy className="size-3" />
                                    </Button>
                                </SheetDescription>
                            </SheetHeader>

                            <div className="space-y-4 px-4 pb-4">
                                {/* Order info */}
                                <div className="grid gap-2 rounded-lg border bg-muted/50 p-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">商品名称</span>
                                        <span className="text-sm font-medium">{result.productName}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">创建时间</span>
                                        <span className="text-sm">{formatDate(result.createdAt)}</span>
                                    </div>
                                    {!result.isPending && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">卡密数量</span>
                                            <span className="text-sm font-medium">{result.cards.length} 条</span>
                                        </div>
                                    )}
                                </div>

                                {/* 状态描述：PENDING 可继续支付 */}
                                {result.isPending && result.canPay && (
                                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200">
                                        <p className="font-medium mb-1.5">订单待支付</p>
                                        <p className="text-xs mb-2">
                                            该订单尚未完成支付，完成支付后即可查看卡密内容。
                                        </p>
                                        {result.expiresAt && (
                                            <p className="text-xs mb-3">
                                                请在{" "}
                                                {new Date(result.expiresAt).toLocaleString("zh-CN", {
                                                    month: "numeric",
                                                    day: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}{" "}
                                                前完成支付。
                                            </p>
                                        )}
                                        <Button
                                            className="w-full gap-2"
                                            onClick={handleContinuePayment}
                                            disabled={continuePaymentLoading}
                                        >
                                            {continuePaymentLoading ? (
                                                <>
                                                    <Loader2 className="size-4 animate-spin" />
                                                    跳转中...
                                                </>
                                            ) : (
                                                <>
                                                    <CreditCard className="size-4" />
                                                    继续支付
                                                </>
                                            )}
                                        </Button>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            如已完成支付但仍显示此提示，请联系客服处理。
                                        </p>
                                    </div>
                                )}

                                {/* 状态描述：PENDING 已超时 */}
                                {result.isPending && !result.canPay && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                        <p className="font-medium mb-1.5">订单待支付（已超时）</p>
                                        <p className="text-xs">
                                            该订单已超过支付时间，无法继续支付。请重新下单。
                                        </p>
                                    </div>
                                )}

                                {/* 状态描述：已关闭且无卡密 */}
                                {!result.isPending && result.status === "CLOSED" && result.cards.length === 0 && (
                                    <div className="rounded-lg border border-muted bg-muted/50 p-3 text-sm text-muted-foreground">
                                        <p className="font-medium mb-0.5">订单已关闭</p>
                                        <p className="text-xs">该订单已关闭，无卡密内容。</p>
                                    </div>
                                )}

                                {/* Empty cards notice（仅已完成且无卡密时显示） */}
                                {!result.isPending && result.status !== "CLOSED" && result.cards.length === 0 && (
                                    <div className="rounded-lg border border-muted bg-muted/50 p-4 text-center">
                                        <Package className="size-8 mx-auto mb-2 text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground">暂无卡密内容</p>
                                    </div>
                                )}

                                {/* Cards list */}
                                {!result.isPending && result.cards.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-semibold">卡密内容</h3>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={copyAllCards}
                                                className="h-7 gap-1.5 text-xs"
                                            >
                                                <Copy className="size-3" />
                                                复制全部
                                            </Button>
                                        </div>
                                        <div className="space-y-1.5">
                                            {result.cards.map((card, index) =>
                                                isFreeSharedCard(card) ? (
                                                    <div
                                                        key={index}
                                                        className="rounded-lg border bg-background p-3 space-y-2"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs text-muted-foreground">账号</span>
                                                            <code className="flex-1 min-w-0 truncate font-mono text-xs text-right">
                                                                {card.account}
                                                            </code>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="shrink-0 h-7"
                                                                onClick={() => copyCard(card.account, index)}
                                                            >
                                                                复制
                                                            </Button>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs text-muted-foreground">密码</span>
                                                            <code className="flex-1 min-w-0 truncate font-mono text-xs text-right">
                                                                {card.password}
                                                            </code>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="shrink-0 h-7"
                                                                onClick={() => copyCard(card.password, index)}
                                                            >
                                                                复制
                                                            </Button>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs text-muted-foreground">地区</span>
                                                            <span className="text-sm">{card.region}</span>
                                                        </div>
                                                        {card.lastCheckedAt != null && card.lastCheckedAt !== "" && (
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-xs text-muted-foreground">上次检查</span>
                                                                <span className="text-sm">{card.lastCheckedAt}</span>
                                                            </div>
                                                        )}
                                                        {card.installStatus != null && card.installStatus !== "" && (
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-xs text-muted-foreground">装好状态</span>
                                                                <span className="text-sm">{card.installStatus}</span>
                                                            </div>
                                                        )}
                                                        <div className="mt-2 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-[11px] text-muted-foreground">
                                                            若无法使用可返回商品页重新领取；仅用于 App Store，请勿在设置或 iCloud 登录。
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        key={index}
                                                        className="group flex items-center gap-2 rounded-lg border bg-background p-2 transition-colors hover:bg-muted/50"
                                                    >
                                                        <code className="flex-1 font-mono text-xs break-all select-all">
                                                            {card.content}
                                                        </code>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-7 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => copyCard(card.content, index)}
                                                            aria-label={`复制第 ${index + 1} 条卡密`}
                                                        >
                                                            {copiedIndex === index ? (
                                                                <Check className="size-3.5 text-green-600" />
                                                            ) : (
                                                                <Copy className="size-3.5" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Tips */}
                                {!result.isPending && result.cards.length > 0 && (
                                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                                        <p className="font-medium mb-1">温馨提示：</p>
                                        <ul className="list-disc list-inside space-y-0.5 text-xs">
                                            <li>请妥善保管订单号和查询密码</li>
                                            <li>卡密内容请及时保存，避免丢失</li>
                                            <li>如有问题，请联系客服</li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}

export default function OrderLookupPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center">加载中...</div>}>
            <OrderLookupPageContent />
        </Suspense>
    )
}
