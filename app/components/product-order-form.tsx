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
}

export function ProductOrderForm({
    productId,
    productName,
    maxQuantity,
    price,
    inStock,
    formId = "product-order-form",
}: ProductOrderFormProps) {
    const [email, setEmail] = useState("")
    const [orderPassword, setOrderPassword] = useState("")
    const [showOrderPassword, setShowOrderPassword] = useState(false)
    const [quantity, setQuantity] = useState(1)
    const [loading, setLoading] = useState(false)
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
    const [turnstileWidgetReady, setTurnstileWidgetReady] = useState(false)

    const router = useRouter()
    const requireTurnstile = Boolean(TURNSTILE_SITE_KEY) && !IS_DEV

    const totalPrice = (price * quantity).toFixed(2)

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
                    quantity,
                    ...(turnstileToken && { turnstileToken }),
                }),
            })

            const data = await res.json()

            if (res.ok) {
                addOrUpdateOrder({
                    orderNo: data.orderNo,
                    productName: productName ?? "商品",
                    amount: data.amount,
                    createdAt: new Date().toISOString(),
                    status: "PENDING",
                })
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

    return (
        <form
            id={formId}
            onSubmit={handleSubmit}
            className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
        >
            <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">立即购买</h3>
                <p className="text-xs text-muted-foreground">
                    支持邮箱接收卡密，请妥善保管订单密码以便后续查询。
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                    id="email"
                    type="email"
                    placeholder="用于接收卡密"
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

            {requireTurnstile && (
                <div className="relative flex min-h-[76px] justify-center">
                    {!turnstileWidgetReady && (
                        <div
                            className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 px-4 py-3"
                            aria-hidden
                        >
                            <Skeleton className="h-10 w-[200px] rounded-full" />
                            <p className="text-xs text-muted-foreground">
                                安全验证加载中… 完成后即可点击「立即购买」
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
                <span className="text-lg font-bold">合计: ¥{totalPrice}</span>
                <Button
                    type="submit"
                    disabled={!inStock || loading || (requireTurnstile && !turnstileToken)}
                    className="hidden lg:flex gap-2"
                >
                    {loading && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />}
                    {loading ? "提交中…" : inStock ? "立即购买" : "售罄"}
                </Button>
            </div>
        </form>
    )
}
