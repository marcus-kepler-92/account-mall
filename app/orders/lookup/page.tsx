"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useForm, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { SiteHeader } from "@/app/components/site-header"
import { useSiteName } from "@/app/components/site-name-provider"
import { Copy, Check, Eye, EyeOff, Loader2, Mail, Hash, Package, Search, Zap, CreditCard, KeyRound, Globe, Clock, Info } from "lucide-react"
import { toast } from "sonner"
import { addOrUpdateOrder } from "@/lib/order-history-storage"
import { applyFieldErrors } from "@/lib/form-utils"
import { orderNoLookupSchema, emailLookupSchema, type OrderLookupFormValues } from "@/lib/validations/lookup"
import { type FreeSharedCardPayload, isFreeSharedCard, formatFreeSharedCardForCopy } from "@/lib/free-shared-card"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CardItem = { content: string } | (FreeSharedCardPayload & { content: string })

interface OrderResult {
    orderNo: string
    productName: string
    createdAt: string
    status: "PENDING" | "COMPLETED" | "CLOSED"
    cards: CardItem[]
    isPending?: boolean
    canPay?: boolean
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

/* ------------------------------------------------------------------ */
/*  Shared utilities (no component deps → hoist outside)               */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    COMPLETED: { label: "已完成", variant: "default" },
    PENDING: { label: "待支付", variant: "secondary" },
    CLOSED: { label: "已关闭", variant: "outline" },
}

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
}

type ApiOk = { ok: true; data: Record<string, any> }  // eslint-disable-line @typescript-eslint/no-explicit-any
type ApiErr = { ok: false; error: string; raw: Record<string, any> }  // eslint-disable-line @typescript-eslint/no-explicit-any
type ApiResult = ApiOk | ApiErr

async function fetchApi(
    endpoint: string,
    body: Record<string, string>,
): Promise<ApiResult> {
    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data?.error ?? "", raw: data }
    return { ok: true, data }
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status]
    return <Badge variant={cfg?.variant ?? "outline"}>{cfg?.label ?? status}</Badge>
}

function FreeSharedCardItem({
    card,
    index,
    copiedId,
    onCopy,
}: {
    card: FreeSharedCardPayload
    index: number
    copiedId: string | null
    onCopy: (content: string, id: string) => void
}) {
    return (
        <div className="rounded-lg border border-border/80 bg-card shadow-sm overflow-hidden">
            <div className="divide-y divide-border/60">
                {/* 账号 */}
                <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-muted/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">账号</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                        <code className="truncate font-mono text-sm text-foreground" title={card.account}>
                            {card.account}
                        </code>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 rounded-full hover:bg-background cursor-pointer"
                            onClick={() => onCopy(card.account, `card-${index}-account`)}
                            aria-label="复制账号"
                        >
                            {copiedId === `card-${index}-account` ? (
                                <Check className="size-4 text-emerald-600" />
                            ) : (
                                <Copy className="size-4" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* 密码 */}
                <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-muted/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">密码</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                        <code className="truncate font-mono text-sm text-foreground" title={card.password}>
                            {card.password}
                        </code>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 rounded-full hover:bg-background cursor-pointer"
                            onClick={() => onCopy(card.password, `card-${index}-password`)}
                            aria-label="复制密码"
                        >
                            {copiedId === `card-${index}-password` ? (
                                <Check className="size-4 text-emerald-600" />
                            ) : (
                                <Copy className="size-4" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* 地区 */}
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">地区</span>
                    </div>
                    <span className="text-sm font-medium text-foreground">{card.region}</span>
                </div>

                {card.lastCheckedAt != null && card.lastCheckedAt !== "" && (
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="flex items-center gap-2.5">
                            <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">上次检查</span>
                        </div>
                        <span className="text-sm text-muted-foreground tabular-nums">{card.lastCheckedAt}</span>
                    </div>
                )}

                {card.installStatus != null && card.installStatus !== "" && (
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">装好状态</span>
                        <span className="text-sm text-foreground">{card.installStatus}</span>
                    </div>
                )}
            </div>

            <div className="flex gap-2.5 px-4 py-3 rounded-b-lg bg-amber-500/5 border-t border-amber-500/10 text-xs text-muted-foreground">
                <Info className="size-4 shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" aria-hidden />
                <p className="leading-relaxed">
                    若无法使用可返回商品页重新领取；仅用于 App Store，请勿在设置或 iCloud 登录。
                </p>
            </div>
        </div>
    )
}

function SimpleCardItem({
    card,
    index,
    copiedId,
    onCopy,
}: {
    card: { content: string }
    index: number
    copiedId: string | null
    onCopy: (content: string, id: string) => void
}) {
    return (
        <div className="group flex items-center gap-2 rounded-lg border bg-background p-2 transition-colors hover:bg-muted/50">
            <code className="flex-1 font-mono text-xs break-all select-all">
                {card.content}
            </code>
            <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 cursor-pointer"
                onClick={() => onCopy(card.content, `card-${index}`)}
                aria-label={`复制第 ${index + 1} 条卡密`}
            >
                {copiedId === `card-${index}` ? (
                    <Check className="size-3.5 text-green-600" />
                ) : (
                    <Copy className="size-3.5" />
                )}
            </Button>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Main page content                                                  */
/* ------------------------------------------------------------------ */

interface OrderLookupFormProps {
    lookupMode: LookupMode
    formRef: React.MutableRefObject<UseFormReturn<OrderLookupFormValues> | null>
    initialOrderNo: string | null
    loading: boolean
    showPassword: boolean
    setShowPassword: React.Dispatch<React.SetStateAction<boolean>>
    setResult: React.Dispatch<React.SetStateAction<OrderResult | null>>
    setOrderList: React.Dispatch<React.SetStateAction<OrderListItem[] | null>>
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
    setSheetOpen: React.Dispatch<React.SetStateAction<boolean>>
}

function OrderLookupForm({
    lookupMode,
    formRef,
    initialOrderNo,
    loading,
    showPassword,
    setShowPassword,
    setResult,
    setOrderList,
    setLoading,
    setSheetOpen,
}: OrderLookupFormProps) {
    const passwordInputRef = useRef<HTMLInputElement>(null)

    const form = useForm<OrderLookupFormValues>({
        resolver: zodResolver(lookupMode === "orderNo" ? orderNoLookupSchema : emailLookupSchema),
        mode: "onTouched",
        shouldUnregister: false,
        defaultValues: { orderNo: "", email: "", password: "" },
    })

    useEffect(() => {
        formRef.current = form
        return () => {
            formRef.current = null
        }
    }, [form, formRef])

    useEffect(() => {
        if (initialOrderNo) {
            form.setValue("orderNo", initialOrderNo)
            setTimeout(() => passwordInputRef.current?.focus(), 100)
        }
    }, [initialOrderNo, form])

    const onSubmit = async (data: OrderLookupFormValues) => {
        const isOrderMode = lookupMode === "orderNo"
        setResult(null)
        setOrderList(null)
        form.clearErrors()
        setLoading(true)

        try {
            const res = await fetchApi(
                isOrderMode ? "/api/orders/lookup" : "/api/orders/lookup-by-email",
                isOrderMode
                    ? { orderNo: data.orderNo.trim(), password: data.password.trim() }
                    : { email: data.email.trim().toLowerCase(), password: data.password.trim() },
            )

            if (!res.ok) {
                applyFieldErrors(res.raw, form.setError)
                form.setError("password", {
                    message: res.error === "Order not found or password incorrect"
                        ? "订单不存在或密码错误"
                        : res.error || "查询失败，请稍后重试",
                })
                return
            }

            if (Array.isArray(res.data.orders)) {
                setOrderList(res.data.orders)
                toast.success(`找到 ${res.data.orders.length} 个相关订单`)
                return
            }

            if (!res.data.orderNo) {
                form.setError("password", { message: "订单不存在或密码错误" })
                return
            }

            setResult(res.data as OrderResult)
            setSheetOpen(true)
            toast.success("查询成功")
        } catch {
            form.setError("password", { message: "网络错误，请稍后重试" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                {lookupMode === "orderNo" ? (
                    <FormField
                        control={form.control}
                        name="orderNo"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>订单号</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="例如：FAK2024021300001"
                                        disabled={loading}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ) : (
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>邮箱地址</FormLabel>
                                <FormControl>
                                    <Input
                                        type="email"
                                        placeholder="例如：user@example.com"
                                        disabled={loading}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field: { ref: fieldRef, ...fieldRest } }) => (
                        <FormItem>
                            <FormLabel>查询密码</FormLabel>
                            <div className="relative">
                                <FormControl>
                                    <Input
                                        ref={(el) => {
                                            fieldRef(el)
                                            ;(passwordInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el
                                        }}
                                        type={showPassword ? "text" : "password"}
                                        placeholder="下单时设置的查询密码"
                                        disabled={loading}
                                        className="pr-10"
                                        {...fieldRest}
                                    />
                                </FormControl>
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
                            <FormMessage />
                        </FormItem>
                    )}
                />
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
        </Form>
    )
}

function OrderLookupPageContent() {
    const searchParams = useSearchParams()
    const siteName = useSiteName()

    const [lookupMode, setLookupMode] = useState<LookupMode>("orderNo")
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<OrderResult | null>(null)
    const [orderList, setOrderList] = useState<OrderListItem[] | null>(null)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [loadingOrderNo, setLoadingOrderNo] = useState<string | null>(null)
    const [sheetLoading, setSheetLoading] = useState(false)
    const [continuePaymentLoading, setContinuePaymentLoading] = useState(false)

    const formRef = useRef<UseFormReturn<OrderLookupFormValues> | null>(null)
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    useEffect(() => () => clearTimeout(copiedTimerRef.current), [])

    useEffect(() => {
        const typeParam = searchParams.get("type")
        const orderNoParam = searchParams.get("orderNo")
        setLookupMode(typeParam === "email" ? "email" : "orderNo")
        if (orderNoParam) {
            setLookupMode("orderNo")
        }
    }, [searchParams])

    const switchMode = useCallback((mode: LookupMode) => {
        setLookupMode(mode)
        setResult(null)
        setOrderList(null)
    }, [])

    /* ---- Clipboard helpers ---- */

    const copyCard = async (content: string, id: string) => {
        try {
            await navigator.clipboard.writeText(content)
            setCopiedId(id)
            toast.success("卡密已复制")
            clearTimeout(copiedTimerRef.current)
            copiedTimerRef.current = setTimeout(() => setCopiedId(null), 2000)
        } catch {
            toast.error("复制失败，请手动复制")
        }
    }

    const copyAllCards = async () => {
        if (!result || result.cards.length === 0) return
        const lines = result.cards.map((card) =>
            isFreeSharedCard(card) ? formatFreeSharedCardForCopy(card) : card.content
        )
        try {
            await navigator.clipboard.writeText(lines.join("\n\n"))
            toast.success(`已复制 ${result.cards.length} 条卡密`)
        } catch {
            toast.error("复制失败，请手动复制")
        }
    }

    /* ---- API handlers ---- */

    const handleOrderClick = async (clickedOrderNo: string) => {
        const password = formRef.current?.getValues("password") ?? ""
        setLoadingOrderNo(clickedOrderNo)
        setSheetLoading(true)
        setSheetOpen(true)
        setResult(null)

        try {
            const res = await fetchApi("/api/orders/lookup", {
                orderNo: clickedOrderNo.trim(),
                password: password.trim(),
            })

            if (!res.ok) {
                toast.error(
                    res.error === "Order not found or password incorrect"
                        ? "订单详情获取失败"
                        : res.error || "查询失败，请稍后重试",
                )
                setSheetOpen(false)
                return
            }

            if (!res.data.orderNo) {
                toast.error("订单详情获取失败")
                setSheetOpen(false)
                return
            }

            setResult(res.data as OrderResult)
            addOrUpdateOrder({
                orderNo: res.data.orderNo,
                productName: res.data.productName ?? "商品",
                amount: res.data.amount ?? 0,
                createdAt: typeof res.data.createdAt === "string" ? res.data.createdAt : new Date().toISOString(),
                status: res.data.status ?? "PENDING",
            })
        } catch {
            toast.error("网络错误，请稍后重试")
            setSheetOpen(false)
        } finally {
            setSheetLoading(false)
            setLoadingOrderNo(null)
        }
    }

    const handleContinuePayment = async () => {
        const password = formRef.current?.getValues("password") ?? ""
        if (!result || !password.trim() || result.isPending !== true || result.canPay !== true) return
        setContinuePaymentLoading(true)
        try {
            const res = await fetchApi("/api/orders/get-payment-url", {
                orderNo: result.orderNo,
                password: password.trim(),
            })
            if (!res.ok) {
                toast.error(res.error || "无法继续支付，请稍后重试")
                return
            }
            if (res.data.paymentUrl) {
                window.location.href = res.data.paymentUrl as string
                return
            }
            toast.error("获取支付链接失败")
        } catch {
            toast.error("网络错误，请稍后重试")
        } finally {
            setContinuePaymentLoading(false)
        }
    }

    /* ---- Render ---- */

    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />

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
                            {/* Lookup mode selector */}
                            <div className="flex gap-2 rounded-lg border p-1">
                                <Button
                                    type="button"
                                    variant={lookupMode === "orderNo" ? "default" : "ghost"}
                                    size="sm"
                                    className="flex flex-1 gap-2"
                                    onClick={() => switchMode("orderNo")}
                                >
                                    <Hash className="size-4" />
                                    订单号查询
                                </Button>
                                <Button
                                    type="button"
                                    variant={lookupMode === "email" ? "default" : "ghost"}
                                    size="sm"
                                    className="flex flex-1 gap-2"
                                    onClick={() => switchMode("email")}
                                >
                                    <Mail className="size-4" />
                                    邮箱查询
                                </Button>
                            </div>

                            {/* Query form — key by lookupMode so resolver matches schema */}
                            <OrderLookupForm
                                key={lookupMode}
                                lookupMode={lookupMode}
                                formRef={formRef}
                                initialOrderNo={searchParams.get("orderNo")}
                                loading={loading}
                                showPassword={showPassword}
                                setShowPassword={setShowPassword}
                                setResult={setResult}
                                setOrderList={setOrderList}
                                setLoading={setLoading}
                                setSheetOpen={setSheetOpen}
                            />

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
                                                            <StatusBadge status={order.status} />
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

                    {!sheetLoading && result && (
                        <>
                            <SheetHeader>
                                <div className="flex items-center justify-between pr-6">
                                    <SheetTitle>订单详情</SheetTitle>
                                    <StatusBadge status={result.status} />
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

                                {/* PENDING + canPay */}
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

                                {/* PENDING + expired */}
                                {result.isPending && !result.canPay && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                        <p className="font-medium mb-1.5">订单待支付（已超时）</p>
                                        <p className="text-xs">
                                            该订单已超过支付时间，无法继续支付。请重新下单。
                                        </p>
                                    </div>
                                )}

                                {/* CLOSED with no cards */}
                                {!result.isPending && result.status === "CLOSED" && result.cards.length === 0 && (
                                    <div className="rounded-lg border border-muted bg-muted/50 p-3 text-sm text-muted-foreground">
                                        <p className="font-medium mb-0.5">订单已关闭</p>
                                        <p className="text-xs">该订单已关闭，无卡密内容。</p>
                                    </div>
                                )}

                                {/* COMPLETED but empty cards */}
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
                                                    <FreeSharedCardItem
                                                        key={index}
                                                        card={card}
                                                        index={index}
                                                        copiedId={copiedId}
                                                        onCopy={copyCard}
                                                    />
                                                ) : (
                                                    <SimpleCardItem
                                                        key={index}
                                                        card={card}
                                                        index={index}
                                                        copiedId={copiedId}
                                                        onCopy={copyCard}
                                                    />
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
