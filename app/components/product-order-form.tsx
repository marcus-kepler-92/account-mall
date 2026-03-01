"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Turnstile } from "@marsidev/react-turnstile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { addOrUpdateOrder } from "@/lib/order-history-storage"
import { Skeleton } from "@/components/ui/skeleton"
import type { FreeSharedCardPayload } from "@/lib/free-shared-card"

const ORDER_FORM_LOADING_EVENT = "product-order-loading"

function dispatchOrderFormLoading(loading: boolean) {
    if (typeof document !== "undefined") {
        document.dispatchEvent(new CustomEvent(ORDER_FORM_LOADING_EVENT, { detail: { loading } }))
    }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""
const IS_DEV = process.env.NODE_ENV === "development"

type ProductOrderFormProps = {
    productId: string
    productName?: string
    maxQuantity: number
    price: number
    inStock: boolean
    formId?: string
    productType?: "NORMAL" | "FREE_SHARED"
}

export function ProductOrderForm({
    productId,
    productName,
    maxQuantity,
    price,
    inStock,
    formId = "product-order-form",
    productType = "NORMAL",
}: ProductOrderFormProps) {
    const [email, setEmail] = useState("")
    const [orderPassword, setOrderPassword] = useState("")
    const [showOrderPassword, setShowOrderPassword] = useState(false)
    const [quantity, setQuantity] = useState(1)
    const [loading, setLoading] = useState(false)
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
    const [turnstileWidgetReady, setTurnstileWidgetReady] = useState(false)
    const [claimedAccount, setClaimedAccount] = useState<FreeSharedCardPayload | null>(null)
    const [freeOrderNoOnly, setFreeOrderNoOnly] = useState<{ orderNo: string } | null>(null)

    const router = useRouter()
    const requireTurnstile = Boolean(TURNSTILE_SITE_KEY) && !IS_DEV
    const isFreeShared = productType === "FREE_SHARED"
    const effectiveQuantity = isFreeShared ? 1 : quantity
    const totalPrice = isFreeShared ? "0.00" : (price * quantity).toFixed(2)

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = parseInt(e.target.value, 10)
        if (Number.isNaN(v) || v < 1) setQuantity(1)
        else if (v > maxQuantity) setQuantity(maxQuantity)
        else setQuantity(v)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!inStock) return

        setLoading(true)
        dispatchOrderFormLoading(true)
        let willRedirect = false
        try {
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId,
                    email: email.trim(),
                    orderPassword,
                    quantity: effectiveQuantity,
                    ...(turnstileToken && { turnstileToken }),
                }),
            })

            const data = await res.json()

            if (res.ok) {
                addOrUpdateOrder({
                    orderNo: data.orderNo,
                    productName: productName ?? "商品",
                    amount: data.amount ?? 0,
                    createdAt: new Date().toISOString(),
                    status: data.claimedAccount ? "COMPLETED" : "PENDING",
                })
                if (data.claimedAccount) {
                    toast.success("领取成功，请复制保存账号信息")
                    setFreeOrderNoOnly(null)
                    setClaimedAccount(data.claimedAccount)
                    try {
                        sessionStorage.setItem(`lookup_prefill_${data.orderNo}`, orderPassword)
                    } catch {
                        /* ignore */
                    }
                    setLoading(false)
                    dispatchOrderFormLoading(false)
                    return
                }
                // 免费商品：禁止跳转，仅本页展示卡密或提示去订单查询
                if (isFreeShared && data.orderNo) {
                    toast.success("领取已记录")
                    setClaimedAccount(null)
                    setFreeOrderNoOnly({ orderNo: data.orderNo })
                    try {
                        sessionStorage.setItem(`lookup_prefill_${data.orderNo}`, orderPassword)
                    } catch {
                        /* ignore */
                    }
                    setLoading(false)
                    dispatchOrderFormLoading(false)
                    return
                }
                if (data.paymentUrl) {
                    try {
                        sessionStorage.setItem(`lookup_prefill_${data.orderNo}`, orderPassword)
                    } catch {
                        // ignore quota or disabled storage
                    }
                    toast.success("订单已创建，正在跳转至支付页面…")
                    willRedirect = true
                    window.location.href = data.paymentUrl
                    return
                }
                if (data.orderNo) {
                    toast.success(`订单已创建，订单号: ${data.orderNo}，请妥善保管订单号和密码`)
                    try {
                        sessionStorage.setItem(`lookup_prefill_${data.orderNo}`, orderPassword)
                    } catch {
                        // ignore quota or disabled storage
                    }
                    willRedirect = true
                    router.push(`/orders/lookup?orderNo=${encodeURIComponent(data.orderNo)}`)
                }
                return
            }

            toast.error(data.error || "下单失败")
        } catch {
            toast.error("下单失败，请稍后重试")
        } finally {
            if (!willRedirect) {
                setLoading(false)
                dispatchOrderFormLoading(false)
            }
        }
    }

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text)
            toast.success(`已复制${label}`)
        } catch {
            toast.error("复制失败")
        }
    }

    return (
        <div className="space-y-4">
            <form
                id={formId}
                onSubmit={handleSubmit}
                className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
            >
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">
                        {isFreeShared ? "免费领取" : "立即购买"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {isFreeShared
                            ? "填写邮箱与订单密码用于记录，领取后请复制保存账号信息。"
                            : "支持邮箱接收卡密，请妥善保管订单密码以便后续查询。"}
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email">邮箱</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder={isFreeShared ? "用于订单记录与查询" : "用于接收卡密"}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={!inStock}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="orderPassword">订单密码</Label>
                    <div className="relative">
                        <Input
                            id="orderPassword"
                            type={showOrderPassword ? "text" : "password"}
                            placeholder="用于查询订单，请妥善保管"
                            value={orderPassword}
                            onChange={(e) => setOrderPassword(e.target.value)}
                            required
                            minLength={6}
                            disabled={!inStock}
                            className="pr-10"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowOrderPassword((v) => !v)}
                            tabIndex={-1}
                            aria-label={showOrderPassword ? "隐藏密码" : "显示密码"}
                        >
                            {showOrderPassword ? (
                                <EyeOff className="size-4 text-muted-foreground" />
                            ) : (
                                <Eye className="size-4 text-muted-foreground" />
                            )}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        6 位以上，用于后续查询订单和卡密
                    </p>
                </div>

                {!isFreeShared && (
                    <div className="space-y-2">
                        <Label htmlFor="quantity">购买数量</Label>
                        <Input
                            id="quantity"
                            type="number"
                            min={1}
                            max={maxQuantity}
                            value={quantity}
                            onChange={handleQuantityChange}
                            disabled={!inStock}
                        />
                    </div>
                )}

                {requireTurnstile && (
                    <div className="relative flex min-h-[76px] justify-center">
                        {!turnstileWidgetReady && (
                            <div
                                className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 px-4 py-3"
                                aria-hidden
                            >
                                <Skeleton className="h-10 w-[200px] rounded-full" />
                                <p className="text-xs text-muted-foreground">
                                    安全验证加载中… 完成后即可点击{isFreeShared ? "「领取」" : "「立即购买」"}
                                </p>
                            </div>
                        )}
                        <Turnstile
                            siteKey={TURNSTILE_SITE_KEY}
                            onSuccess={(token) => setTurnstileToken(token)}
                            onExpire={() => setTurnstileToken(null)}
                            onWidgetLoad={() => setTurnstileWidgetReady(true)}
                        />
                    </div>
                )}

                <div className="flex items-center justify-between pt-2">
                    <span className="text-lg font-bold">
                        {isFreeShared ? "免费" : `合计: ¥${totalPrice}`}
                    </span>
                    <Button
                        type="submit"
                        disabled={!inStock || loading || (requireTurnstile && !turnstileToken)}
                        className="hidden lg:flex gap-2"
                    >
                        {loading && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />}
                        {loading
                            ? "提交中…"
                            : isFreeShared
                              ? "领取一个账号"
                              : inStock
                                ? "立即购买"
                                : "售罄"}
                    </Button>
                </div>
            </form>

            {freeOrderNoOnly && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-sm sm:p-5">
                    <h3 className="mb-3 text-sm font-semibold text-foreground">领取已记录</h3>
                    <p className="mb-3 text-xs text-muted-foreground">
                        请使用订单号与查询密码在订单查询中查看卡密。
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            router.push(
                                `/orders/lookup?orderNo=${encodeURIComponent(freeOrderNoOnly.orderNo)}`
                            )
                        }
                    >
                        去订单查询
                    </Button>
                </div>
            )}

            {claimedAccount && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 shadow-sm sm:p-5">
                    <h3 className="mb-3 text-sm font-semibold text-foreground">领取成功</h3>
                    <p className="mb-3 text-xs text-muted-foreground">
                        请复制保存以下信息，或通过订单查询（订单号+订单密码）再次查看。
                    </p>
                    {claimedAccount.lastCheckedAt != null && claimedAccount.lastCheckedAt !== "" && (
                        <p className="mb-3 text-xs text-muted-foreground">
                            上次检查：{claimedAccount.lastCheckedAt}
                        </p>
                    )}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
                            <span className="text-xs text-muted-foreground">账号</span>
                            <span className="min-w-0 flex-1 truncate text-right font-mono text-sm">
                                {claimedAccount.account}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(claimedAccount.account, "账号")}
                            >
                                复制
                            </Button>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
                            <span className="text-xs text-muted-foreground">密码</span>
                            <span className="min-w-0 flex-1 truncate text-right font-mono text-sm">
                                {claimedAccount.password}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(claimedAccount.password, "密码")}
                            >
                                复制
                            </Button>
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
                            <span className="text-xs text-muted-foreground">地区</span>
                            <span className="text-sm">{claimedAccount.region}</span>
                        </div>
                        {claimedAccount.installStatus != null && claimedAccount.installStatus !== "" && (
                            <div className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
                                <span className="text-xs text-muted-foreground">装好状态</span>
                                <span className="text-sm">{claimedAccount.installStatus}</span>
                            </div>
                        )}
                    </div>
                    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground/90">温馨提示</p>
                        <p className="mt-0.5">
                            若账号无法使用（如提示异常、无法登录），可返回本页重新领取一个。仅用于 App Store 下载，请勿在【设置】或 iCloud 中登录，以免锁机。
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
