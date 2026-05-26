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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { SiteHeader } from "@/app/components/site-header"
import { useSiteName } from "@/app/components/site-name-provider"
import { ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Loader2, Mail, Hash, Package, Search, Zap, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { addOrUpdateOrder } from "@/lib/order-history-storage"
import { formatDateTime } from "@/lib/utils"
import { applyFieldErrors } from "@/lib/form-utils"
import {
    orderNoLookupSchema,
    emailLookupSchema,
    orderDetailPasswordSchema,
    type OrderLookupFormValues,
    type OrderDetailPasswordValues,
} from "@/lib/validations/lookup"
import { OrderDetailContent } from "./order-detail-content"
import {
    clearLookupPasswordCache,
    readLookupPasswordCache,
    writeLookupPasswordCache,
} from "./lookup-password-cache"
import type { OrderResult, OrderListItem, LookupMode } from "./types"

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    COMPLETED: { label: "已完成", variant: "default" },
    PENDING: { label: "待支付", variant: "secondary" },
    AWAITING_FULFILLMENT: { label: "等待发货", variant: "secondary" },
    PROCESSING: { label: "发货中", variant: "secondary" },
    CLOSED: { label: "已关闭", variant: "outline" },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiOk = { ok: true; data: Record<string, any> }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiErr = { ok: false; error: string; raw: Record<string, any> }
type ApiResult = ApiOk | ApiErr

async function fetchApi(
    endpoint: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: Record<string, any>,
    timeoutMs = 15_000,
): Promise<ApiResult> {
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

interface PaginationMeta {
    total: number
    page: number
    pageSize: number
    totalPages: number
}

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
    setListEmail: React.Dispatch<React.SetStateAction<string | null>>
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
    setSheetOpen: React.Dispatch<React.SetStateAction<boolean>>
    setPagination: React.Dispatch<React.SetStateAction<PaginationMeta | null>>
}

const EMAIL_LOOKUP_PAGE_SIZE = 10

function OrderLookupForm({
    lookupMode, formRef, initialOrderNo, initialEmail, loading,
    showPassword, setShowPassword,
    setResult, setOrderList, setListEmail, setLoading, setSheetOpen, setPagination,
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
        // Auto-focus password only in orderNo mode (email mode has no pwd field).
        if (lookupMode === "orderNo" && initialOrderNo) {
            setTimeout(() => passwordInputRef.current?.focus(), 100)
        }
    }, [initialOrderNo, initialEmail, lookupMode, form])

    const onSubmit = async (data: OrderLookupFormValues) => {
        const isOrderMode = lookupMode === "orderNo"
        setResult(null)
        setOrderList(null)
        setPagination(null)
        form.clearErrors()
        setLoading(true)
        try {
            if (isOrderMode) {
                const res = await fetchApi(
                    "/api/orders/lookup",
                    { orderNo: data.orderNo.trim(), password: data.password.trim() },
                    15_000,
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
                return
            }

            // Email mode → list-only fetch. New contract: never returns a single
            // order detail — always { orders, total, page, pageSize, totalPages }.
            const normalizedEmail = data.email.trim().toLowerCase()
            const res = await fetchApi(
                "/api/orders/lookup-by-email",
                {
                    email: normalizedEmail,
                    page: 1,
                    pageSize: EMAIL_LOOKUP_PAGE_SIZE,
                },
                20_000,
            )
            if (!res.ok) {
                applyFieldErrors(res.raw, form.setError)
                form.setError("email", {
                    message: res.error || "查询失败，请稍后重试",
                })
                return
            }
            const orders: OrderListItem[] = Array.isArray(res.data.orders) ? res.data.orders : []
            const total = typeof res.data.total === "number" ? res.data.total : orders.length
            const page = typeof res.data.page === "number" ? res.data.page : 1
            const pageSize = typeof res.data.pageSize === "number" ? res.data.pageSize : EMAIL_LOOKUP_PAGE_SIZE
            const totalPages = typeof res.data.totalPages === "number"
                ? res.data.totalPages
                : Math.max(1, Math.ceil(total / pageSize))
            setOrderList(orders)
            setListEmail(normalizedEmail)
            setPagination({ total, page, pageSize, totalPages })
            // Switching emails invalidates any cached per-row password.
            clearLookupPasswordCache()
            if (total === 0) {
                // Empty list is rendered inline below — no field error.
                return
            }
            toast.success(`找到 ${total} 个相关订单`)
        } catch {
            form.setError(isOrderMode ? "password" : "email", { message: "网络错误，请稍后重试" })
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
                {lookupMode === "orderNo" && (
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
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <><Loader2 className="mr-2 size-4 animate-spin" />查询中...</> : <><Search className="mr-2 size-4" />查询订单</>}
                </Button>
                {lookupMode === "email" && (
                    <p className="text-xs text-muted-foreground">
                        邮箱查询只需邮箱地址；查看任意订单详情时再输入对应的查询密码。
                    </p>
                )}
            </form>
        </Form>
    )
}

/* ------------------------------------------------------------------ */
/*  Per-row password Dialog                                            */
/* ------------------------------------------------------------------ */

interface PasswordDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderNo: string | null
    onSubmit: (password: string) => Promise<{ ok: boolean; error?: string }>
}

function OrderDetailPasswordDialog({ open, onOpenChange, orderNo, onSubmit }: PasswordDialogProps) {
    const [showPassword, setShowPassword] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const form = useForm<OrderDetailPasswordValues>({
        resolver: zodResolver(orderDetailPasswordSchema),
        defaultValues: { password: "" },
    })

    // Reset on open/close so leftover values from a previous click don't
    // surface against a different order.
    useEffect(() => {
        if (!open) {
            form.reset({ password: "" })
            setSubmitting(false)
            setShowPassword(false)
        }
    }, [open, form])

    const handleSubmit = form.handleSubmit(async ({ password }) => {
        setSubmitting(true)
        try {
            const res = await onSubmit(password.trim())
            if (!res.ok) {
                form.setError("password", { message: res.error || "密码错误" })
                return
            }
            onOpenChange(false)
        } finally {
            setSubmitting(false)
        }
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>查询密码</DialogTitle>
                    <DialogDescription>
                        {orderNo
                            ? <>查看订单 <span className="font-mono">{orderNo}</span> 需要输入对应的查询密码。</>
                            : "查看订单需要输入对应的查询密码。"}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <FormField control={form.control} name="password" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="sr-only">查询密码</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="请输入下单时设置的查询密码"
                                            className="pr-10"
                                            autoFocus
                                            {...field}
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
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                取消
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? <><Loader2 className="mr-2 size-4 animate-spin" />验证中</> : "确认"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
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
    const [listEmail, setListEmail] = useState<string | null>(null)
    const [pagination, setPagination] = useState<PaginationMeta | null>(null)
    const [pageLoading, setPageLoading] = useState(false)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [sheetLoading, setSheetLoading] = useState(false)
    // Detail-password Dialog state.
    const [pwDialogOpen, setPwDialogOpen] = useState(false)
    const [pendingOrderNo, setPendingOrderNo] = useState<string | null>(null)
    const [loadingOrderNo, setLoadingOrderNo] = useState<string | null>(null)
    // Cached password for the detail flow — preferred over the form's password
    // because the email-mode form has no password field. Keeps OrderDetailContent's
    // getPassword() callback working for downstream actions (dun / check-payment).
    const [detailPassword, setDetailPassword] = useState<string>("")

    const formRef = useRef<UseFormReturn<OrderLookupFormValues> | null>(null)
    const getPassword = useCallback(
        () => detailPassword || formRef.current?.getValues("password") || "",
        [detailPassword],
    )

    const fetchPage = useCallback(async (targetPage: number) => {
        if (!listEmail || !pagination) return
        setPageLoading(true)
        try {
            const res = await fetchApi(
                "/api/orders/lookup-by-email",
                {
                    email: listEmail,
                    page: targetPage,
                    pageSize: pagination.pageSize,
                },
                20_000,
            )
            if (!res.ok || !Array.isArray(res.data.orders)) {
                toast.error("加载下一页失败，请稍后重试")
                return
            }
            setOrderList(res.data.orders as OrderListItem[])
            const total = typeof res.data.total === "number" ? res.data.total : res.data.orders.length
            const page = typeof res.data.page === "number" ? res.data.page : targetPage
            const pageSize = typeof res.data.pageSize === "number" ? res.data.pageSize : pagination.pageSize
            const totalPages = typeof res.data.totalPages === "number"
                ? res.data.totalPages
                : Math.max(1, Math.ceil(total / pageSize))
            setPagination({ total, page, pageSize, totalPages })
        } catch {
            toast.error("网络错误，请稍后重试")
        } finally {
            setPageLoading(false)
        }
    }, [listEmail, pagination])

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
        setListEmail(null)
        setPagination(null)
        setDetailPassword("")
        clearLookupPasswordCache()
    }, [])

    const resetEmail = useCallback(() => {
        // 「换邮箱」 — back to State A (form input).
        setOrderList(null)
        setListEmail(null)
        setPagination(null)
        setResult(null)
        setDetailPassword("")
        clearLookupPasswordCache()
    }, [])

    /**
     * Open detail Sheet for a row. Tries the sessionStorage password cache
     * first — most buyers use one password for all orders, so the second click
     * onward should skip the Dialog entirely.
     */
    const openDetailWithPassword = useCallback(async (
        targetOrderNo: string,
        password: string,
    ): Promise<{ ok: boolean; error?: string }> => {
        setLoadingOrderNo(targetOrderNo)
        setSheetLoading(true)
        setSheetOpen(true)
        setResult(null)
        try {
            const res = await fetchApi(
                "/api/orders/lookup",
                { orderNo: targetOrderNo.trim(), password: password.trim() },
                15_000,
            )
            if (!res.ok || !res.data.orderNo) {
                setSheetOpen(false)
                setResult(null)
                const msg = res.ok === false && res.error === "Order not found or password incorrect"
                    ? "密码错误"
                    : (res.ok === false ? res.error : "") || "查询失败，请稍后重试"
                return { ok: false, error: msg }
            }
            setResult(res.data as OrderResult)
            setDetailPassword(password)
            if (listEmail) writeLookupPasswordCache(listEmail, password)
            addOrUpdateOrder({
                orderNo: res.data.orderNo,
                productName: res.data.productName ?? "商品",
                amount: res.data.amount ?? 0,
                createdAt: typeof res.data.createdAt === "string" ? res.data.createdAt : new Date().toISOString(),
                status: res.data.status ?? "PENDING",
            })
            return { ok: true }
        } catch {
            setSheetOpen(false)
            setResult(null)
            return { ok: false, error: "网络错误，请稍后重试" }
        } finally {
            setSheetLoading(false)
            setLoadingOrderNo(null)
        }
    }, [listEmail])

    const handleOrderClick = useCallback(async (clickedOrderNo: string) => {
        // Try the cached password first (per-tab, scoped to current email).
        const cached = listEmail ? readLookupPasswordCache(listEmail) : null
        if (cached) {
            const res = await openDetailWithPassword(clickedOrderNo, cached)
            if (res.ok) return
            // Cached password no longer valid (rotated? wrong order?) — wipe
            // it and fall through to the Dialog.
            clearLookupPasswordCache()
            setDetailPassword("")
        }
        setPendingOrderNo(clickedOrderNo)
        setPwDialogOpen(true)
    }, [listEmail, openDetailWithPassword])

    const handlePasswordDialogSubmit = useCallback(async (password: string) => {
        if (!pendingOrderNo) return { ok: false, error: "请重新选择订单" }
        return openDetailWithPassword(pendingOrderNo, password)
    }, [pendingOrderNo, openDetailWithPassword])

    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />

            <main className="flex-1">
                <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle>订单查询</CardTitle>
                            <CardDescription>输入订单号或邮箱查看你的订单与账号内容。</CardDescription>
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

                            {/* State A / B-header: form unless we're showing a list, then header */}
                            {lookupMode === "email" && orderList !== null && listEmail ? (
                                <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                                    <div className="min-w-0">
                                        <p className="text-sm">
                                            邮箱 <span className="font-mono">{listEmail}</span> 下的订单
                                            <span className="ml-1 text-muted-foreground">（共 {pagination?.total ?? orderList.length} 单）</span>
                                        </p>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={resetEmail}>
                                        <ArrowLeft className="size-3.5" />换邮箱
                                    </Button>
                                </div>
                            ) : (
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
                                    setListEmail={setListEmail}
                                    setLoading={setLoading}
                                    setSheetOpen={setSheetOpen}
                                    setPagination={setPagination}
                                />
                            )}

                            {/* State B: email lookup results list */}
                            {lookupMode === "email" && orderList !== null && (
                                orderList.length === 0 ? (
                                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                                        该邮箱下没有订单。请确认邮箱地址是否填写正确。
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <h3 className="flex items-center gap-2 text-base font-semibold">
                                                <Package className="size-4" />共 {pagination?.total ?? orderList.length} 个订单
                                            </h3>
                                            <p className="text-xs text-muted-foreground">点击任意订单，输入对应查询密码后查看详情</p>
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
                                                            <div className="min-w-0 truncate text-sm font-medium">
                                                                {order.productName}
                                                                {order.variantName ? <span className="ml-1 text-muted-foreground">· {order.variantName}</span> : null}
                                                            </div>
                                                            {isLoadingThis
                                                                ? <Loader2 className="size-3.5 shrink-0 animate-spin" />
                                                                : <Badge variant={cfg?.variant ?? "outline"} className="shrink-0 text-[10px]">{cfg?.label ?? order.status}</Badge>}
                                                        </div>
                                                        <div className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
                                                            <span className="truncate font-mono">{order.orderNo}</span>
                                                            <span className="shrink-0">{formatDateTime(order.createdAt)}</span>
                                                        </div>
                                                    </Button>
                                                )
                                            })}
                                        </div>
                                        {pagination && pagination.totalPages > 1 && (
                                            <div className="flex items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
                                                <span>第 {pagination.page} / {pagination.totalPages} 页</span>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={pagination.page <= 1 || pageLoading}
                                                        onClick={() => fetchPage(pagination.page - 1)}
                                                    >
                                                        <ChevronLeft className="size-3.5" />上一页
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={pagination.page >= pagination.totalPages || pageLoading}
                                                        onClick={() => fetchPage(pagination.page + 1)}
                                                    >
                                                        下一页<ChevronRight className="size-3.5" />
                                                    </Button>
                                                    {pageLoading && <Loader2 className="size-3.5 animate-spin" />}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
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

            {/* 详情密码 Dialog（State C） */}
            <OrderDetailPasswordDialog
                open={pwDialogOpen}
                onOpenChange={setPwDialogOpen}
                orderNo={pendingOrderNo}
                onSubmit={handlePasswordDialogSubmit}
            />

            {/* 订单详情 Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="w-full overflow-y-auto overflow-x-hidden sm:max-w-md">
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
                                <div className="flex min-w-0 items-center gap-1.5">
                                    <SheetDescription className="min-w-0 flex-1 truncate font-mono text-xs">
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
