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
import {
    Copy, Check, Eye, EyeOff, Loader2, Mail, Hash, Package, Search,
    Zap, CreditCard, KeyRound, Globe, Clock, Info, RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { addOrUpdateOrder } from "@/lib/order-history-storage"
import { formatDateTime, formatDateTimeShort } from "@/lib/utils"
import { applyFieldErrors } from "@/lib/form-utils"
import { orderNoLookupSchema, emailLookupSchema, type OrderLookupFormValues } from "@/lib/validations/lookup"
import { type AutoFetchCardPayload, isAutoFetchCard, formatAutoFetchCardForCopy, toCardContentJson } from "@/lib/auto-fetch-card"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CardItem = { content: string } | (AutoFetchCardPayload & { content: string })

interface OrderResult {
    orderNo: string
    productName: string
    createdAt: string
    status: "PENDING" | "COMPLETED" | "CLOSED"
    cards: CardItem[]
    isPending?: boolean
    canPay?: boolean
    /** PENDING 订单的支付截止时间 */
    expiresAt?: string
    /** AUTO_FETCH 账号内容有效期 */
    contentExpiresAt?: string
    isAutoFetch?: boolean
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

async function fetchApi(endpoint: string, body: Record<string, string>): Promise<ApiResult> {
    const { fetchWithTimeout } = await import("@/lib/fetch-with-timeout")
    const res = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        timeoutMs: 15_000,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data?.error ?? "", raw: data }
    return { ok: true, data }
}

function useCountdownMs(isoStr: string | null): number | null {
    const [remaining, setRemaining] = useState<number | null>(null)
    useEffect(() => {
        if (!isoStr) return
        const target = new Date(isoStr).getTime()
        const update = () => setRemaining(Math.max(0, target - Date.now()))
        update()
        const id = setInterval(update, 1000)
        return () => clearInterval(id)
    }, [isoStr])
    return remaining
}

function formatCountdownMs(ms: number): string {
    if (ms <= 0) return "已过期"
    const s = Math.floor(ms / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status]
    return <Badge variant={cfg?.variant ?? "outline"}>{cfg?.label ?? status}</Badge>
}

function AutoFetchCardRow({
    card, index, copiedId, onCopy,
}: {
    card: AutoFetchCardPayload
    index: number
    copiedId: string | null
    onCopy: (content: string, id: string) => void
}) {
    const prefix = `card-${index}`
    return (
        <div className="rounded-lg border border-border/80 bg-card shadow-sm overflow-hidden">
            <div className="divide-y divide-border/60">
                <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-muted/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">账号</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                        <code className="truncate font-mono text-sm text-foreground" title={card.account}>{card.account}</code>
                        <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full hover:bg-background cursor-pointer"
                            onClick={() => onCopy(card.account, `${prefix}-account`)} aria-label="复制账号">
                            {copiedId === `${prefix}-account` ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                        </Button>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-muted/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">密码</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                        <code className="truncate font-mono text-sm text-foreground" title={card.password}>{card.password}</code>
                        <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full hover:bg-background cursor-pointer"
                            onClick={() => onCopy(card.password, `${prefix}-password`)} aria-label="复制密码">
                            {copiedId === `${prefix}-password` ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                        </Button>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">地区</span>
                    </div>
                    <span className="text-sm font-medium text-foreground">{card.region}</span>
                </div>
                {card.lastCheckedAt && card.lastCheckedAt !== "" && (
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="flex items-center gap-2.5">
                            <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">上次检查</span>
                        </div>
                        <span className="text-sm text-muted-foreground tabular-nums">{card.lastCheckedAt}</span>
                    </div>
                )}
                {card.installStatus && card.installStatus !== "" && (
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">装好状态</span>
                        <span className="text-sm text-foreground">{card.installStatus}</span>
                    </div>
                )}
            </div>
            <div className="flex gap-2.5 px-4 py-3 rounded-b-lg bg-amber-500/5 border-t border-amber-500/10 text-xs text-muted-foreground">
                <Info className="size-4 shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" aria-hidden />
                <p className="leading-relaxed">
                    仅用于 App Store，请勿在设置或 iCloud 登录。如密码失效，可在下方获取最新密码。
                </p>
            </div>
        </div>
    )
}

function SimpleCardRow({
    card, index, copiedId, onCopy,
}: {
    card: { content: string }
    index: number
    copiedId: string | null
    onCopy: (content: string, id: string) => void
}) {
    return (
        <div className="group flex items-center gap-2 rounded-lg border bg-background p-2 transition-colors hover:bg-muted/50">
            <code className="flex-1 font-mono text-xs break-all select-all">{card.content}</code>
            <Button variant="ghost" size="icon" className="size-7 shrink-0 cursor-pointer"
                onClick={() => onCopy(card.content, `card-${index}`)} aria-label={`复制第 ${index + 1} 条卡密`}>
                {copiedId === `card-${index}` ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
            </Button>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  OrderDetailContent — 订单详情，两种查询方式共用                        */
/* ------------------------------------------------------------------ */

function OrderDetailContent({
    result: initialResult,
    getPassword,
}: {
    result: OrderResult
    /** 从查询表单中取当前填写的密码（用于继续支付） */
    getPassword: () => string
}) {
    const [result, setResult] = useState<OrderResult>(initialResult)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [refreshPassword, setRefreshPassword] = useState("")
    const [refreshLoading, setRefreshLoading] = useState(false)
    const [continuePaymentLoading, setContinuePaymentLoading] = useState(false)
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    // 当外部 result 变化时（切换订单）同步
    useEffect(() => {
        setResult(initialResult)
        setRefreshPassword("")
        setCopiedId(null)
    }, [initialResult.orderNo, initialResult])

    useEffect(() => () => clearTimeout(copiedTimerRef.current), [])

    const copyCard = useCallback(async (content: string, id: string) => {
        try {
            await navigator.clipboard.writeText(content)
            setCopiedId(id)
            clearTimeout(copiedTimerRef.current)
            copiedTimerRef.current = setTimeout(() => setCopiedId(null), 2000)
            toast.success("已复制")
        } catch {
            toast.error("复制失败，请手动复制")
        }
    }, [])

    const copyAllCards = useCallback(async () => {
        if (result.cards.length === 0) return
        const lines = result.cards.map((card) =>
            isAutoFetchCard(card) ? formatAutoFetchCardForCopy(card) : card.content
        )
        try {
            await navigator.clipboard.writeText(lines.join("\n\n"))
            toast.success(`已复制 ${result.cards.length} 条`)
        } catch {
            toast.error("复制失败，请手动复制")
        }
    }, [result.cards])

    const handleRefresh = useCallback(async () => {
        if (!refreshPassword) return
        setRefreshLoading(true)
        try {
            const res = await fetch(`/api/orders/${encodeURIComponent(result.orderNo)}/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: refreshPassword }),
            })
            const data = await res.json() as {
                refreshed?: boolean
                payload?: AutoFetchCardPayload
                accountChanged?: boolean
                error?: string
            }
            if (!res.ok) { toast.error(data.error || "获取失败"); return }
            if (data.refreshed && data.payload) {
                setResult((prev) => ({
                    ...prev,
                    cards: [{ content: toCardContentJson(data.payload!), ...data.payload! }],
                }))
                setRefreshPassword("")
                toast.success(data.accountChanged ? "已换新账号" : "已获取最新账号信息")
            } else {
                toast.error(data.error || "暂时无法获取，请稍后重试")
            }
        } catch { toast.error("网络异常，请稍后重试") }
        finally { setRefreshLoading(false) }
    }, [result.orderNo, refreshPassword])

    const handleContinuePayment = useCallback(async () => {
        const password = getPassword()
        if (!result.isPending || !result.canPay || !password) return
        setContinuePaymentLoading(true)
        try {
            const res = await fetchApi("/api/orders/get-payment-url", {
                orderNo: result.orderNo,
                password: password.trim(),
            })
            if (!res.ok) { toast.error(res.error || "无法继续支付"); return }
            if (res.data.paymentUrl) { window.location.href = res.data.paymentUrl as string; return }
            toast.error("获取支付链接失败")
        } catch { toast.error("网络错误，请稍后重试") }
        finally { setContinuePaymentLoading(false) }
    }, [result, getPassword])

    const remaining = useCountdownMs(result.contentExpiresAt ?? null)
    const isContentExpired = !!result.contentExpiresAt && remaining !== null && remaining <= 0

    return (
        <div className="space-y-4">
            {/* 基本信息 */}
            <div className="grid gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">商品名称</span>
                    <span className="font-medium">{result.productName}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">创建时间</span>
                    <span>{formatDateTime(result.createdAt)}</span>
                </div>
                {!result.isPending && result.cards.length > 0 && (
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">卡密数量</span>
                        <span className="font-medium">{result.cards.length} 条</span>
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">订单状态</span>
                    <div className="flex items-center gap-1.5">
                        <StatusBadge status={result.status} />
                        {isContentExpired && (
                            <Badge variant="destructive" className="text-[10px]">已过期</Badge>
                        )}
                    </div>
                </div>
                {!result.isPending && result.isAutoFetch && result.status === "COMPLETED" && result.contentExpiresAt && (
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">可用时间</span>
                        {isContentExpired ? (
                            <span className="text-xs font-medium text-destructive">已过期</span>
                        ) : (
                            <span className="font-mono font-medium tabular-nums text-sm">
                                {remaining !== null ? formatCountdownMs(remaining) : "—"}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* 待支付 — 可继续付款 */}
            {result.isPending && result.canPay && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200 space-y-2">
                    <p className="font-medium">订单待支付</p>
                    <p className="text-xs">该订单尚未完成支付，完成支付后即可查看账号内容。</p>
                    {result.expiresAt && (
                        <p className="text-xs">
                            请在 {formatDateTimeShort(result.expiresAt)} 前完成支付。
                        </p>
                    )}
                    <Button className="w-full gap-2" onClick={handleContinuePayment} disabled={continuePaymentLoading}>
                        {continuePaymentLoading
                            ? <><Loader2 className="size-4 animate-spin" />跳转中...</>
                            : <><CreditCard className="size-4" />继续支付</>}
                    </Button>
                    <p className="text-xs text-muted-foreground">如已完成支付但仍显示此提示，请联系客服处理。</p>
                </div>
            )}

            {/* 待支付 — 已超时 */}
            {result.isPending && !result.canPay && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    <p className="font-medium mb-1">订单已超时</p>
                    <p className="text-xs">支付时间已过，无法继续支付，请重新下单。</p>
                </div>
            )}

            {/* 已关闭 */}
            {!result.isPending && result.status === "CLOSED" && result.cards.length === 0 && (
                <div className="rounded-lg border border-muted bg-muted/50 p-3 text-sm text-muted-foreground">
                    <p className="font-medium mb-0.5">订单已关闭</p>
                    <p className="text-xs">该订单已关闭，无账号内容。</p>
                </div>
            )}

            {/* 完成但无卡密 */}
            {!result.isPending && result.status !== "CLOSED" && result.cards.length === 0 && (
                <div className="rounded-lg border border-muted bg-muted/50 p-4 text-center">
                    <Package className="size-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">暂无账号内容</p>
                </div>
            )}

            {/* 账号列表 */}
            {!result.isPending && result.cards.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">账号内容</h3>
                        <Button variant="outline" size="sm" onClick={copyAllCards} className="h-7 gap-1.5 text-xs">
                            <Copy className="size-3" />复制全部
                        </Button>
                    </div>
                    <div className="space-y-1.5">
                        {result.cards.map((card, index) =>
                            isAutoFetchCard(card) ? (
                                <AutoFetchCardRow key={index} card={card} index={index} copiedId={copiedId} onCopy={copyCard} />
                            ) : (
                                <SimpleCardRow key={index} card={card} index={index} copiedId={copiedId} onCopy={copyCard} />
                            )
                        )}
                    </div>
                </div>
            )}

            {/* AUTO_FETCH：获取最新密码（仅未过期时显示） */}
            {!result.isPending && result.isAutoFetch && result.status === "COMPLETED" && !isContentExpired && (
                <div className="border-t pt-3 space-y-1.5">
                    <p className="text-xs text-muted-foreground">密码登录失败？获取最新密码：</p>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            placeholder="输入下单时设置的订单密码"
                            value={refreshPassword}
                            onChange={(e) => setRefreshPassword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleRefresh()}
                            className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                        <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5"
                            disabled={refreshLoading || !refreshPassword} onClick={handleRefresh}>
                            <RefreshCw className={`size-3.5 ${refreshLoading ? "animate-spin" : ""}`} />
                            {refreshLoading ? "获取中…" : "获取最新密码"}
                        </Button>
                    </div>
                </div>
            )}

            {/* 温馨提示 */}
            {!result.isPending && result.cards.length > 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                    <p className="font-medium mb-1">温馨提示：</p>
                    <ul className="list-disc list-inside space-y-0.5">
                        <li>请妥善保管订单号和查询密码</li>
                        <li>账号内容请及时保存，避免丢失</li>
                        <li>如有问题，请联系客服</li>
                    </ul>
                </div>
            )}
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Query form                                                         */
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
    lookupMode, formRef, initialOrderNo, loading,
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
        const typeParam = searchParams.get("type")
        const orderNoParam = searchParams.get("orderNo")
        setLookupMode(typeParam === "email" ? "email" : "orderNo")
        if (orderNoParam) setLookupMode("orderNo")
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
                                                    className={`h-auto flex-col items-start gap-1.5 p-3 text-left ${isSelected ? "border-primary" : ""}`}
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

            {/* 订单详情 Sheet — 两种查询方式共用同一个组件 */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
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
