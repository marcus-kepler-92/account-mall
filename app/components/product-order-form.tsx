"use client"

import { useState } from "react"
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
    const totalPrice = isFreeShared ? "0.00" : (price * (isFreeShared ? 1 : quantity)).toFixed(2)
    const effectiveQuantity = isFreeShared ? 1 : quantity

    const onSubmit = async (data: OrderFormSchema) => {
        if (!inStock) return

        dispatchOrderFormLoading(true)
        let willRedirect = false
        try {
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId,
                    email: data.email.trim(),
                    orderPassword: data.orderPassword,
                    quantity: effectiveQuantity,
                    ...(turnstileToken && { turnstileToken }),
                }),
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
