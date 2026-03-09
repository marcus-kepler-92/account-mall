"use client"

import { useState, useEffect, useCallback } from "react"
import { useRequest } from "ahooks"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Turnstile } from "@marsidev/react-turnstile"
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
import { createOrderFormSchema, type OrderFormSchema } from "@/lib/validations/order"
import { configClient } from "@/lib/config-client"
import { Skeleton } from "@/components/ui/skeleton"
import { useProductPriceSyncStore } from "@/lib/stores/product-price-sync"

const ORDER_FORM_LOADING_EVENT = "product-order-loading"

function dispatchOrderFormLoading(loading: boolean) {
    if (typeof document !== "undefined") {
        document.dispatchEvent(new CustomEvent(ORDER_FORM_LOADING_EVENT, { detail: { loading } }))
    }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""
const IS_DEV = process.env.NODE_ENV === "development"

function isValidDiscountCodeFormat(code: string, maxLength: number = configClient.promoCodeMaxLength): boolean {
    const t = code.trim()
    return t.length >= 1 && t.length <= maxLength
}

type ValidatePromoResponse = { valid?: boolean; discountPercent?: number | null }

function normalizePromoValidation(data: ValidatePromoResponse | undefined): PromoValidation {
    if (data == null) return null
    return {
        valid: data.valid === true,
        discountPercent:
            data.valid === true && typeof data.discountPercent === "number" ? data.discountPercent : null,
    }
}

type PromoValidation = {
    valid: boolean
    discountPercent: number | null
} | null

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
    const [showOrderPassword, setShowOrderPassword] = useState(false)
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
    const [turnstileWidgetReady, setTurnstileWidgetReady] = useState(false)
    const [discountCode, setDiscountCode] = useState("")

    const validatePromo = useCallback((code: string) => {
        return fetch(`/api/validate-promo-code?promoCode=${encodeURIComponent(code)}`, {
            credentials: "same-origin",
        }).then((res) => res.json()) as Promise<ValidatePromoResponse>
    }, [])

    const { data: promoData, loading: promoValidating, run: runValidatePromo, mutate: setPromoData } = useRequest(
        validatePromo,
        {
            manual: true,
            debounceWait: configClient.promoValidateDebounceMs,
        }
    )

    const promoValidation = normalizePromoValidation(promoData)
    const setDisplay = useProductPriceSyncStore((s) => s.setDisplay)

    const router = useRouter()
    const requireTurnstile = Boolean(TURNSTILE_SITE_KEY) && !IS_DEV
    const isFreeShared = productType === "FREE_SHARED"

    const form = useForm<OrderFormSchema>({
        resolver: zodResolver(createOrderFormSchema(maxQuantity)),
        mode: "onTouched",
        defaultValues: {
            email: "",
            orderPassword: "",
            quantity: 1,
        },
    })

    const quantity = form.watch("quantity")
    const effectiveQuantity = isFreeShared ? 1 : quantity
    const codeTrimmed = discountCode.trim()
    const hasValidDiscountCodeFormat = codeTrimmed !== "" && isValidDiscountCodeFormat(discountCode)

    // 防抖异步校验优惠码（ahooks useRequest）
    useEffect(() => {
        if (!hasValidDiscountCodeFormat) {
            setPromoData(undefined)
            return
        }
        runValidatePromo(codeTrimmed)
    }, [codeTrimmed, hasValidDiscountCodeFormat, runValidatePromo, setPromoData])

    const totalPrice = isFreeShared
        ? "0.00"
        : promoValidation?.valid && promoValidation.discountPercent != null
          ? (price * effectiveQuantity * (1 - promoValidation.discountPercent / 100)).toFixed(2)
          : (price * effectiveQuantity).toFixed(2)

    useEffect(() => {
        setDisplay(
            totalPrice,
            isFreeShared,
            promoValidation?.valid ? promoValidation.discountPercent ?? null : null
        )
    }, [totalPrice, isFreeShared, promoValidation?.valid, promoValidation?.discountPercent, setDisplay])

    const onSubmit = async (data: OrderFormSchema) => {
        if (!inStock) return

        dispatchOrderFormLoading(true)
        let willRedirect = false
        try {
            const payload: Record<string, unknown> = {
                productId,
                email: data.email.trim(),
                orderPassword: data.orderPassword,
                quantity: effectiveQuantity,
                ...(turnstileToken && { turnstileToken }),
            }
            const codeTrimmed = discountCode.trim()
            if (codeTrimmed && isValidDiscountCodeFormat(codeTrimmed)) {
                payload.promoCode = codeTrimmed
            }
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            const responseData = await res.json()

            if (res.ok) {
                addOrUpdateOrder({
                    orderNo: responseData.orderNo,
                    productName: productName ?? "商品",
                    amount: responseData.amount ?? 0,
                    createdAt: new Date().toISOString(),
                    status: responseData.claimedAccount ? "COMPLETED" : "PENDING",
                })
                if (responseData.successToken && responseData.orderNo) {
                    toast.success(isFreeShared ? "领取成功" : "订单已创建")
                    willRedirect = true
                    router.push(
                        `/orders/${encodeURIComponent(responseData.orderNo)}/success?token=${encodeURIComponent(responseData.successToken)}`,
                    )
                    return
                }
                if (responseData.paymentUrl) {
                    toast.success("订单已创建，正在跳转至支付页面…")
                    willRedirect = true
                    window.location.href = responseData.paymentUrl
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
            toast.error(responseData.error || "下单失败")
        } catch {
            toast.error("下单失败，请稍后重试")
        } finally {
            if (!willRedirect) {
                dispatchOrderFormLoading(false)
            }
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
                            {isFreeShared ? "免费领取" : "立即购买"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {isFreeShared
                                ? "填写邮箱与订单密码用于记录，领取后请复制保存账号信息。"
                                : "支持邮箱接收卡密，请妥善保管订单密码以便后续查询。"}
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
                                        placeholder={isFreeShared ? "用于订单记录与查询" : "用于接收卡密"}
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
                                <FormLabel>订单密码</FormLabel>
                                <div className="relative">
                                    <FormControl>
                                        <Input
                                            type={showOrderPassword ? "text" : "password"}
                                            placeholder="用于查询订单，请妥善保管"
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
                                <FormDescription>6 位以上，用于后续查询订单和卡密</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {!isFreeShared && (
                        <FormField
                            control={form.control}
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>购买数量</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={maxQuantity}
                                            disabled={!inStock}
                                            {...field}
                                            onChange={(e) => {
                                                const v = parseInt(e.target.value, 10)
                                                if (Number.isNaN(v) || v < 1) field.onChange(1)
                                                else if (v > maxQuantity) field.onChange(maxQuantity)
                                                else field.onChange(v)
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    {!isFreeShared && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none">优惠码</label>
                            <Input
                                type="text"
                                placeholder={`选填，1–${configClient.promoCodeMaxLength} 字符`}
                                disabled={!inStock}
                                maxLength={configClient.promoCodeMaxLength}
                                value={discountCode}
                                onChange={(e) => setDiscountCode(e.target.value)}
                                className="font-mono"
                            />
                            {discountCode.trim() !== "" && !isValidDiscountCodeFormat(discountCode) && (
                                <p className="text-xs text-destructive">优惠码格式：1–{configClient.promoCodeMaxLength} 个字符</p>
                            )}
                            {hasValidDiscountCodeFormat && (
                                <p className="text-xs text-muted-foreground">
                                    {promoValidating
                                        ? "校验中…"
                                        : promoValidation?.valid && promoValidation.discountPercent != null
                                          ? `已享 ${promoValidation.discountPercent}% 优惠`
                                          : promoValidation?.valid
                                            ? "推荐码有效，但未开通折扣"
                                            : promoValidation && !promoValidation.valid
                                              ? "推荐码无效"
                                              : "校验中…"}
                                </p>
                            )}
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

                    {/* 桌面端显示合计 + 提交按钮；移动端仅低栏显示到手价，此处隐藏避免重复 */}
                    <div className="hidden lg:flex items-center justify-between pt-2">
                        <span className="text-lg font-bold">
                            {isFreeShared
                                ? "免费"
                                : promoValidation?.valid && promoValidation.discountPercent != null
                                  ? `合计: ¥${totalPrice}（已享 ${promoValidation.discountPercent}% 优惠）`
                                  : `合计: ¥${totalPrice}`}
                        </span>
                        <Button
                            type="submit"
                            disabled={!inStock || form.formState.isSubmitting || (requireTurnstile && !turnstileToken)}
                            className="hidden lg:flex gap-2"
                        >
                            {form.formState.isSubmitting && (
                                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                            )}
                            {form.formState.isSubmitting
                                ? "提交中…"
                                : isFreeShared
                                  ? "领取一个账号"
                                  : inStock
                                    ? "立即购买"
                                    : "售罄"}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}
