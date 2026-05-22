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
import { Copy, Eye, EyeOff, Loader2, Mail, Hash, Package, Search, Zap } from "lucide-react"
import { toast } from "sonner"
import { addOrUpdateOrder } from "@/lib/order-history-storage"
import { formatDateTime } from "@/lib/utils"
import { applyFieldErrors } from "@/lib/form-utils"
import { orderNoLookupSchema, emailLookupSchema, type OrderLookupFormValues } from "@/lib/validations/lookup"
import { OrderDetailContent } from "./order-detail-content"
import type { OrderResult, OrderListItem, LookupMode } from "./types"

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    COMPLETED: { label: "已完成", variant: "default" },
    PENDING: { label: "待支付", variant: "secondary" },
    CLOSED: { label: "已关闭", variant: "outline" },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiOk = { ok: true; data: Record<string, any> }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiErr = { ok: false; error: string; raw: Record<string, any> }
type ApiResult = ApiOk | ApiErr

async function fetchApi(endpoint: string, body: Record<string, string>, timeoutMs = 15_000): Promise<ApiResult> {
    const { fetchWithTimeout } = await import("@/lib/fetch-with-timeout")
    const res = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        timeoutMs,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data?.error ?? "", raw: data }
    return { ok: true, data }
}

/* ------------------------------------------------------------------ */
/*  Query form                                                         */
/* ------------------------------------------------------------------ */

interface OrderLookupFormProps {
    lookupMode: LookupMode
    formRef: React.MutableRefObject<UseFormReturn<OrderLookupFormValues> | null>
    initialOrderNo: string | null
    initialEmail: string | null
    loading: boolean
    showPassword: boolean
    setShowPassword: React.Dispatch<React.SetStateAction<boolean>>
    setResult: React.Dispatch<React.SetStateAction<OrderResult | null>>
    setOrderList: React.Dispatch<React.SetStateAction<OrderListItem[] | null>>
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
    setSheetOpen: React.Dispatch<React.SetStateAction<boolean>>
}

function OrderLookupForm({
    lookupMode, formRef, initialOrderNo, initialEmail, loading,
    showPassword, setShowPassword,
    setResult, setOrderList, setLoading, setSheetOpen,
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
        return () => { formRef.current = null }
    }, [form, formRef])

    useEffect(() => {
        // Hydrate both fields so the "other" mode also keeps the URL preset
        // when the user manually switches tabs (form remounts via key, so
        // each mount needs to re-apply both values from props).
        if (initialOrderNo) form.setValue("orderNo", initialOrderNo)
        if (initialEmail) form.setValue("email", initialEmail)
        const currentModeFilled =
            (lookupMode === "orderNo" && initialOrderNo) ||
            (lookupMode === "email" && initialEmail)
        if (currentModeFilled) {
            setTimeout(() => passwordInputRef.current?.focus(), 100)
        }
    }, [initialOrderNo, initialEmail, lookupMode, form])

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
                isOrderMode ? 15_000 : 40_000,
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
            addOrUpdateOrder({
                orderNo: res.data.orderNo,
                productName: res.data.productName ?? "商品",
                amount: res.data.amount ?? 0,
                createdAt: typeof res.data.createdAt === "string" ? res.data.createdAt : new Date().toISOString(),
                status: res.data.status ?? "PENDING",
            })
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
                    <FormField control={form.control} name="orderNo" render={({ field }) => (
                        <FormItem>
                            <FormLabel>订单号</FormLabel>
                            <FormControl>
                                <Input placeholder="请输入订单号" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                ) : (
                    <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem>
                            <FormLabel>邮箱</FormLabel>
                            <FormControl>
                                <Input type="email" placeholder="请输入下单时使用的邮箱" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                )}
                <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                        <FormLabel>查询密码</FormLabel>
                        <FormControl>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="请输入下单时设置的查询密码"
                                    className="pr-10"
                                    {...field}
                                    ref={(el) => {
                                        passwordInputRef.current = el
                                        if (typeof field.ref === "function") field.ref(el)
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                    onClick={() => setShowPassword((v) => !v)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </Button>
                            </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <><Loader2 className="mr-2 size-4 animate-spin" />查询中...</> : <><Search className="mr-2 size-4" />查询订单</>}
                </Button>
            </form>
        </Form>
    )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

function OrderLookupPageContent() {
    const searchParams = useSearchParams()
    const siteName = useSiteName()

    const [lookupMode, setLookupMode] = useState<LookupMode>("orderNo")
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<OrderResult | null>(null)
    const [orderList, setOrderList] = useState<OrderListItem[] | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [loadingOrderNo, setLoadingOrderNo] = useState<string | null>(null)
    const [sheetLoading, setSheetLoading] = useState(false)

    const formRef = useRef<UseFormReturn<OrderLookupFormValues> | null>(null)
    const getPassword = useCallback(() => formRef.current?.getValues("password") ?? "", [])

    useEffect(() => {
        // URL is the single source of truth for initial query state.
        // Inference order (first match wins):
        //   1. explicit `mode`
        //   2. legacy `type=email` (kept for existing links)
        //   3. `email` present + no `orderNo` → email mode
        //   4. `orderNo` present → orderNo mode
        //   5. default → orderNo
        const modeParam = searchParams.get("mode")
        const typeParam = searchParams.get("type")
        const orderNoParam = searchParams.get("orderNo")
        const emailParam = searchParams.get("email")
        let inferred: LookupMode = "orderNo"
        if (modeParam === "email" || modeParam === "orderNo") inferred = modeParam
        else if (typeParam === "email") inferred = "email"
        else if (emailParam && !orderNoParam) inferred = "email"
        else if (orderNoParam) inferred = "orderNo"
        setLookupMode(inferred)
    }, [searchParams])

    const switchMode = useCallback((mode: LookupMode) => {
        setLookupMode(mode)
        setResult(null)
        setOrderList(null)
    }, [])

    const handleOrderClick = useCallback(async (clickedOrderNo: string) => {
        const password = getPassword()
        setLoadingOrderNo(clickedOrderNo)
        setSheetLoading(true)
        setSheetOpen(true)
        setResult(null)
        try {
            const res = await fetchApi("/api/orders/lookup", {
                orderNo: clickedOrderNo.trim(),
                password: password.trim(),
            })
            if (!res.ok || !res.data.orderNo) {
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
    }, [getPassword])

    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />

            <main className="flex-1">
                <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle>订单查询</CardTitle>
                            <CardDescription>输入订单号或邮箱，以及下单时设置的查询密码，查看账号内容。</CardDescription>
                            {searchParams.get("fromPay") === "1" && searchParams.get("orderNo") && (
                                <div className="mt-3 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                                    支付已完成！若未自动展示账号，请输入查询密码并点击「查询订单」。
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* 查询方式切换 */}
                            <div className="flex gap-2 rounded-lg border p-1">
                                <Button type="button" variant={lookupMode === "orderNo" ? "default" : "ghost"}
                                    size="sm" className="flex flex-1 gap-2" onClick={() => switchMode("orderNo")}>
                                    <Hash className="size-4" />订单号查询
                                </Button>
                                <Button type="button" variant={lookupMode === "email" ? "default" : "ghost"}
                                    size="sm" className="flex flex-1 gap-2" onClick={() => switchMode("email")}>
                                    <Mail className="size-4" />邮箱查询
                                </Button>
                            </div>

                            {/* 查询表单 */}
                            <OrderLookupForm
                                key={lookupMode}
                                lookupMode={lookupMode}
                                formRef={formRef}
                                initialOrderNo={searchParams.get("orderNo")}
                                initialEmail={searchParams.get("email")}
                                loading={loading}
                                showPassword={showPassword}
                                setShowPassword={setShowPassword}
                                setResult={setResult}
                                setOrderList={setOrderList}
                                setLoading={setLoading}
                                setSheetOpen={setSheetOpen}
                            />

                            {/* 邮箱查询结果列表 */}
                            {orderList && orderList.length > 0 && (
                                <div className="space-y-3 border-t pt-4">
                                    <div className="space-y-1">
                                        <h3 className="text-base font-semibold flex items-center gap-2">
                                            <Package className="size-4" />找到 {orderList.length} 个订单
                                        </h3>
                                        <p className="text-xs text-muted-foreground">点击任意订单查看详情</p>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {orderList.map((order) => {
                                            const cfg = STATUS_CONFIG[order.status]
                                            const isLoadingThis = loadingOrderNo === order.orderNo
                                            const isSelected = result?.orderNo === order.orderNo && sheetOpen
                                            return (
                                                <Button
                                                    key={order.orderNo}
                                                    variant="outline"
                                                    className={`h-auto w-full min-w-0 flex-col items-start gap-1.5 p-3 text-left ${isSelected ? "border-primary" : ""}`}
                                                    onClick={() => handleOrderClick(order.orderNo)}
                                                    disabled={isLoadingThis}
                                                >
                                                    <div className="flex w-full items-center justify-between gap-2">
                                                        <span className="truncate text-sm font-medium">{order.productName}</span>
                                                        {isLoadingThis
                                                            ? <Loader2 className="size-3.5 shrink-0 animate-spin" />
                                                            : <Badge variant={cfg?.variant ?? "outline"} className="text-[10px] shrink-0">{cfg?.label ?? order.status}</Badge>}
                                                    </div>
                                                    <div className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
                                                        <span className="font-mono truncate">{order.orderNo}</span>
                                                        <span className="shrink-0">{formatDateTime(order.createdAt)}</span>
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

            <footer className="border-t">
                <div className="mx-auto max-w-6xl px-4 py-8">
                    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="flex size-6 items-center justify-center rounded-md bg-primary">
                                    <Zap className="size-3 text-primary-foreground" />
                                </div>
                                <span className="text-sm font-medium">{siteName}</span>
                            </div>
                            <nav className="flex gap-4 text-sm text-muted-foreground">
                                <Link href="/orders/lookup" className="hover:text-foreground transition-colors">订单查询</Link>
                            </nav>
                        </div>
                        <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} {siteName}</p>
                    </div>
                </div>
            </footer>

            {/* 订单详情 Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto overflow-x-hidden">
                    {sheetLoading ? (
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
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </>
                    ) : result ? (
                        <>
                            <SheetHeader className="border-b pr-10">
                                <SheetTitle>订单详情</SheetTitle>
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <SheetDescription className="font-mono text-xs truncate min-w-0 flex-1">
                                        {result.orderNo}
                                    </SheetDescription>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-5 shrink-0 text-muted-foreground"
                                        onClick={() => { navigator.clipboard.writeText(result.orderNo); toast.success("订单号已复制") }}
                                    >
                                        <Copy className="size-3" />
                                    </Button>
                                </div>
                            </SheetHeader>
                            <div className="px-4 pb-4">
                                <OrderDetailContent result={result} getPassword={getPassword} />
                            </div>
                        </>
                    ) : null}
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
