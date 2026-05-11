"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Package, CreditCard } from "lucide-react"
import { toast } from "sonner"
import { formatDateTime, formatDateTimeShort } from "@/lib/utils"
import { type AutoFetchCardPayload, isAutoFetchCard, toCardContentJson } from "@/lib/auto-fetch-card"
import { resolveCardFields } from "@/lib/card-format"
import { OrderCardDisplay, type CardDisplayItem } from "@/app/components/order-detail/card-display"
import { OrderAutoFetchTroubleshoot } from "@/app/components/order-detail/auto-fetch-troubleshoot"
import { useCountdown, formatCountdown } from "@/app/components/order-detail/use-countdown"
import type { OrderResult } from "./types"

async function fetchApi(endpoint: string, body: Record<string, string>) {
    const { fetchWithTimeout } = await import("@/lib/fetch-with-timeout")
    const res = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        timeoutMs: 15_000,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false as const, error: data?.error ?? "", raw: data }
    return { ok: true as const, data }
}

type Props = {
    result: OrderResult
    getPassword: () => string
}

export function OrderDetailContent({ result: initialResult, getPassword }: Props) {
    const [result, setResult] = useState<OrderResult>(initialResult)
    const [continuePaymentLoading, setContinuePaymentLoading] = useState(false)

    useEffect(() => {
        setResult(initialResult)
    }, [initialResult.orderNo, initialResult])

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

    const remainingMs = useCountdown(result.contentExpiresAt ?? null)
    const isContentExpired = !!result.contentExpiresAt && remainingMs !== null && remainingMs <= 0

    const templates = result.cardTemplates ?? []
    const displayCards: CardDisplayItem[] = result.cards.map((card) => {
        if (isAutoFetchCard(card)) return { type: "autoFetch", payload: card }
        return resolveCardFields(card.content, templates)
    })

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
                {!result.isPending && result.isAutoFetch && result.status === "COMPLETED" && result.contentExpiresAt && (
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">可用时间</span>
                        {isContentExpired ? (
                            <span className="text-xs font-medium text-destructive">已过期</span>
                        ) : (
                            <span className="font-mono font-medium tabular-nums text-sm">
                                {remainingMs !== null ? formatCountdown(remainingMs) : "—"}
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
                    <h3 className="text-sm font-semibold">账号内容</h3>
                    <OrderCardDisplay cards={displayCards} />
                </div>
            )}

            {/* AUTO_FETCH：刷新密码 + 换号 */}
            {!result.isPending && result.isAutoFetch && result.status === "COMPLETED" && !isContentExpired && result.successToken && (
                <OrderAutoFetchTroubleshoot
                    orderNo={result.orderNo}
                    expiresAt={result.contentExpiresAt ?? null}
                    token={result.successToken}
                    remainingSwitches={result.remainingSwitches ?? 0}
                    onRefreshed={(payload: AutoFetchCardPayload) => {
                        setResult((prev) => ({
                            ...prev,
                            cards: [{ content: toCardContentJson(payload), ...payload }],
                        }))
                    }}
                    onSwitched={(payload: AutoFetchCardPayload) => {
                        setResult((prev) => ({
                            ...prev,
                            cards: [{ content: toCardContentJson(payload), ...payload }],
                            canSwitch: (prev.remainingSwitches ?? 1) - 1 > 0,
                            remainingSwitches: Math.max(0, (prev.remainingSwitches ?? 1) - 1),
                        }))
                    }}
                />
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
