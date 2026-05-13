"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRequest } from "ahooks"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { addOrUpdateOrder } from "@/lib/order-history-storage"
import { applyFieldErrors } from "@/lib/form-utils"
import { createOrderFormSchema, type OrderFormSchema, type PaymentMethod } from "@/lib/validations/order"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { configClient } from "@/lib/config-client"
import { useProductPriceSyncStore } from "@/lib/stores/product-price-sync"
import { useTurnstileStore } from "@/lib/stores/turnstile"
import { ProductOrderQuantityPicker } from "./product-order-quantity-picker"
import { ProductOrderTurnstile } from "./product-order-turnstile"
import { useFingerprint } from "@/hooks/use-fingerprint"
import { SiAlipay, SiWechat, SiQq } from "react-icons/si"

const PAYMENT_METHOD_CONFIG: Record<PaymentMethod, { label: string; icon: typeof SiAlipay; color: string }> = {
    alipay: { label: "支付宝", icon: SiAlipay, color: "#1677FF" },
    wxpay: { label: "微信支付", icon: SiWechat, color: "#07C160" },
    qqpay: { label: "QQ 钱包", icon: SiQq, color: "#1B8FE6" },
}

const ORDER_FORM_LOADING_EVENT = "product-order-loading"

function dispatchOrderFormLoading(loading: boolean) {
    if (typeof document !== "undefined") {
        document.dispatchEvent(new CustomEvent(ORDER_FORM_LOADING_EVENT, { detail: { loading } }))
    }
}

function isValidDiscountCodeFormat(code: string): boolean {
    const t = code.trim()
    return t.length >= 1 && t.length <= configClient.promoCodeMaxLength
}

type ValidatePromoResponse = { valid?: boolean; discountPercent?: number | null }

type PromoValidation = {
    valid: boolean
    discountPercent: number | null
} | null

function normalizePromoValidation(data: ValidatePromoResponse | undefined): PromoValidation {
    if (data == null) return null
    return {
        valid: data.valid === true,
        discountPercent:
            data.valid === true && typeof data.discountPercent === "number"
                ? data.discountPercent
                : null,
    }
}

type ProductOrderFormProps = {
    productId: string
    productName?: string
    maxQuantity: number
    price: number
    inStock: boolean
    formId?: string
    productType?: "NORMAL" | "AUTO_FETCH"
    couponEnabled?: boolean
    requireTurnstile: boolean
    prefilledEmail?: string
    exitDiscountToken?: string | null
    exitDiscountPercent?: number | null
    onExitDiscountConsumed?: () => void
    crossSellToken?: string | null
    crossSellDiscountPercent?: number | null
}

export function ProductOrderForm({
    productId,
    productName,
    maxQuantity,
    price,
    inStock,
    formId = "product-order-form",
    productType = "NORMAL",
    couponEnabled = false,
    requireTurnstile,
    prefilledEmail,
    exitDiscountToken = null,
    exitDiscountPercent = null,
    onExitDiscountConsumed,
    crossSellToken = null,
    crossSellDiscountPercent = null,
}: ProductOrderFormProps) {
    const [showOrderPassword, setShowOrderPassword] = useState(false)
    const [discountCode, setDiscountCode] = useState("")
    const turnstileToken = useTurnstileStore((s) => s.token)
    const turnstileStatus = useTurnstileStore((s) => s.status)

    const validatePromo = useCallback((code: string) => {
        if (!couponEnabled) return Promise.resolve<ValidatePromoResponse>({})
        return fetch(`/api/validate-promo-code?promoCode=${encodeURIComponent(code)}`, {
            credentials: "same-origin",
        }).then((res) => res.json()) as Promise<ValidatePromoResponse>
    }, [couponEnabled])

    const {
        data: promoData,
        loading: promoValidating,
        run: runValidatePromo,
        mutate: setPromoData,
    } = useRequest(validatePromo, {
        manual: true,
        debounceWait: configClient.promoValidateDebounceMs,
    })

    const promoValidation = normalizePromoValidation(promoData)
    const setDisplay = useProductPriceSyncStore((s) => s.setDisplay)
    const router = useRouter()
    const turnstileLoading = requireTurnstile && turnstileStatus !== "ready" && turnstileStatus !== "unsupported"
    const isAutoFetch = productType === "AUTO_FETCH"
    const isFree = isAutoFetch && price === 0
    const fingerprintHash = useFingerprint()
    const submittingRef = useRef(false)

    const form = useForm<OrderFormSchema>({
        resolver: zodResolver(createOrderFormSchema(maxQuantity)),
        mode: "onTouched",
        defaultValues: { email: prefilledEmail ?? "", orderPassword: "", quantity: 1, paymentMethod: "alipay" as PaymentMethod },
    })

    // 指纹就绪时写入表单，保持所有字段数据来源统一
    useEffect(() => {
        if (fingerprintHash) {
            form.setValue("fingerprintHash", fingerprintHash)
        }
    }, [fingerprintHash, form])

    const disabledSet = new Set(configClient.yipayDisabledPaymentTypes)
    const allPaymentMethods = configClient.yipayPaymentTypes
        .map((id) => ({ id: id as PaymentMethod, disabled: disabledSet.has(id), ...PAYMENT_METHOD_CONFIG[id as PaymentMethod] }))
        .filter(Boolean)
    const showPaymentSelector = !isFree && allPaymentMethods.length >= 1

    const quantity = form.watch("quantity")
    const effectiveQuantity = isAutoFetch ? 1 : quantity
    const codeTrimmed = discountCode.trim()

    useEffect(() => {
        if (!codeTrimmed || !isValidDiscountCodeFormat(discountCode)) {
            setPromoData(undefined)
            return
        }
        runValidatePromo(codeTrimmed)
    }, [codeTrimmed, discountCode, runValidatePromo, setPromoData])

    // Exit discount: show whenever token is present (stacking allowed on first paid order)
    const activeExitDiscount =
        exitDiscountToken && exitDiscountPercent != null
            ? exitDiscountPercent
            : null

    const activeCrossSellDiscount =
        crossSellToken && crossSellDiscountPercent != null
            ? crossSellDiscountPercent
            : null

    const totalPrice = isFree
        ? "0.00"
        : (() => {
            let amt = price * effectiveQuantity
            const promo = promoValidation?.valid ? promoValidation.discountPercent : null
            if (promo != null) amt = amt * (1 - promo / 100)
            if (activeExitDiscount != null) amt = amt * (1 - activeExitDiscount / 100)
            if (activeCrossSellDiscount != null) amt = amt * (1 - activeCrossSellDiscount / 100)
            return amt.toFixed(2)
        })()

    const activeDiscountPercent = (() => {
        const promo = promoValidation?.valid ? promoValidation.discountPercent : null
        const discount = activeCrossSellDiscount ?? activeExitDiscount
        if (promo != null && discount != null) {
            return Math.round((1 - (1 - promo / 100) * (1 - discount / 100)) * 100)
        }
        return promo ?? discount
    })()

    useEffect(() => {
        setDisplay(totalPrice, isFree, activeDiscountPercent ?? null)
    }, [totalPrice, isFree, activeDiscountPercent, setDisplay])

    const onSubmit = async (data: OrderFormSchema) => {
        if (!inStock) return
        if (requireTurnstile && !turnstileToken && turnstileStatus !== "unsupported") {
            toast.error("安全验证尚未完成，请稍候再试")
            return
        }
        if (submittingRef.current) return
        submittingRef.current = true
        dispatchOrderFormLoading(true)
        let willRedirect = false
        try {
            const payload: Record<string, unknown> = {
                productId,
                email: data.email.trim(),
                orderPassword: data.orderPassword,
                quantity: effectiveQuantity,
                paymentMethod: data.paymentMethod,
                fingerprintHash: data.fingerprintHash,
                ...(turnstileToken && { turnstileToken }),
            }
            if (activeCrossSellDiscount != null && crossSellToken) {
                payload.crossSellToken = crossSellToken
            } else if (codeTrimmed && isValidDiscountCodeFormat(codeTrimmed)) {
                payload.promoCode = codeTrimmed
            } else if (exitDiscountToken && activeExitDiscount != null) {
                payload.exitDiscountToken = exitDiscountToken
            }
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const responseData = await res.json()

            if (res.ok) {
                onExitDiscountConsumed?.()
                addOrUpdateOrder({
                    orderNo: responseData.orderNo,
                    productName: productName ?? "商品",
                    amount: responseData.amount ?? 0,
                    createdAt: new Date().toISOString(),
                    status: responseData.claimedAccount ? "COMPLETED" : "PENDING",
                })
                if (responseData.successToken && responseData.orderNo) {
                    toast.success(isFree ? "领取成功" : "订单已创建")
                    willRedirect = true
                    router.push(
                        `/orders/${encodeURIComponent(responseData.orderNo)}/success?token=${encodeURIComponent(responseData.successToken)}`
                    )
                    return
                }
                if (responseData.paymentUrl && responseData.orderNo) {
                    toast.success("订单已创建，正在跳转至支付页面…")
                    willRedirect = true
                    window.location.href = responseData.paymentUrl as string
                    return
                }
                if (responseData.orderNo) {
                    toast.success(`订单已创建，订单号: ${responseData.orderNo}，请妥善保管订单号和密码`)
                    willRedirect = true
                    router.push(`/orders/lookup?orderNo=${encodeURIComponent(responseData.orderNo)}`)
                }
                return
            }

            applyFieldErrors(responseData, form.setError)
            if (res.status === 429 && responseData.orderNo) {
                toast.warning(responseData.error, {
                    action: {
                        label: "查看订单",
                        onClick: () => router.push(`/orders/lookup?orderNo=${encodeURIComponent(responseData.orderNo)}`),
                    },
                    duration: 8000,
                })
            } else {
                toast.error(responseData.error || "下单失败")
            }
        } catch {
            toast.error("下单失败，请稍后重试")
        } finally {
            submittingRef.current = false
            if (!willRedirect) dispatchOrderFormLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            <Form {...form}>
                <form
                    id={formId}
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
                >
                    <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">
                        {isFree ? "免费领取" : "立即购买"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {isFree
                            ? "填写邮箱与查询密码用于记录，领取后请复制保存账号信息。"
                            : "支持邮箱接收卡密，请妥善保管查询密码以便后续查询。"}
                    </p>
                    </div>

                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>邮箱</FormLabel>
                                <FormControl>
                        <Input
                                    type="email"
                                    placeholder={isFree ? "用于订单记录与查询" : "用于接收卡密"}
                                        disabled={!inStock}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="orderPassword"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>订单查询密码</FormLabel>
                                <div className="relative">
                                    <FormControl>
                                        <Input
                                            type={showOrderPassword ? "text" : "password"}
                                            placeholder="自行设置，非邮箱密码"
                                            disabled={!inStock}
                                            className="pr-10"
                                            {...field}
                                        />
                                    </FormControl>
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
                                <FormDescription>与邮箱密码无关，自己设置 6 位以上，用于后续查询订单</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {activeCrossSellDiscount != null && (
                        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                            ✓ 已应用成功页专享 {activeCrossSellDiscount}% 折扣
                        </div>
                    )}

                    <ProductOrderQuantityPicker
                        isAutoFetch={isAutoFetch}
                        isFree={isFree}
                        couponEnabled={activeCrossSellDiscount != null ? false : couponEnabled}
                        maxQuantity={maxQuantity}
                        inStock={inStock}
                        discountCode={discountCode}
                        onDiscountCodeChange={setDiscountCode}
                        promoValidating={promoValidating}
                        promoValidation={promoValidation}
                    />

                    {showPaymentSelector && (
                        <FormField
                            control={form.control}
                            name="paymentMethod"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>支付方式</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            value={field.value}
                                            onValueChange={(v) => {
                                                if (!disabledSet.has(v as PaymentMethod)) field.onChange(v)
                                            }}
                                            className="flex flex-wrap gap-2"
                                            disabled={!inStock}
                                        >
                                            {allPaymentMethods.map((method) => (
                                                <Label
                                                    key={method.id}
                                                    htmlFor={`pm-${method.id}`}
                                                    className={[
                                                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                                                        method.disabled
                                                            ? "opacity-50 cursor-not-allowed border-input bg-muted text-muted-foreground"
                                                            : field.value === method.id
                                                              ? "cursor-pointer border-primary bg-primary/5 text-primary"
                                                              : "cursor-pointer border-input bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                                                        !inStock ? "opacity-50 cursor-not-allowed" : "",
                                                    ].join(" ")}
                                                >
                                                    <RadioGroupItem
                                                        id={`pm-${method.id}`}
                                                        value={method.id}
                                                        className="sr-only"
                                                        disabled={method.disabled}
                                                    />
                                                    <method.icon size={18} color={method.disabled ? undefined : method.color} />
                                                    {method.label}
                                                </Label>
                                            ))}
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    {requireTurnstile && (
                        <ProductOrderTurnstile siteKey={configClient.turnstileSiteKey} />
                    )}

                    <div className="hidden lg:flex items-center justify-between pt-2">
                        <span className="text-lg font-bold">
                            {isFree
                                ? "免费"
                                : activeDiscountPercent != null
                                  ? `合计: ¥${totalPrice}（已享 ${activeDiscountPercent}% 优惠）`
                                  : `合计: ¥${totalPrice}`}
                        </span>
                        <Button
                            type="submit"
                            disabled={
                                !inStock ||
                                !fingerprintHash ||
                                form.formState.isSubmitting ||
                                (requireTurnstile && turnstileStatus !== "ready" && turnstileStatus !== "unsupported")
                            }
                            className="hidden lg:flex gap-2"
                        >
                            {(form.formState.isSubmitting || (turnstileLoading && turnstileStatus !== "interactive")) && (
                                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                            )}
                            {form.formState.isSubmitting
                                ? "提交中…"
                                : turnstileStatus === "interactive"
                                  ? "请先完成安全验证 ↑"
                                  : turnstileLoading
                                    ? "准备中…"
                                    : isFree
                                      ? "免费领取"
                                      : inStock
                                        ? "立即购买"
                                        : "售罄"}
                        </Button>
                    </div>
                    <p className="text-center text-xs text-muted-foreground">
                        下单即表示您同意{" "}
                        <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-foreground transition-colors">用户协议</Link>
                        、<Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-foreground transition-colors">隐私政策</Link>
                        {" "}及{" "}
                        <Link href="/refund" target="_blank" className="underline underline-offset-2 hover:text-foreground transition-colors">售后政策</Link>
                    </p>
                </form>
            </Form>
        </div>
    )
}
