"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ManualStatusTimeline } from "@/app/orders/[orderNo]/manual-status-timeline"
import { useManualStatusPoll } from "@/app/orders/[orderNo]/use-manual-status-poll"

// Delays (ms) between consecutive polls: 9 gaps → 10 total polls over ~64 seconds
const POLL_SCHEDULE = [3000, 3000, 5000, 5000, 8000, 8000, 10000, 10000, 12000]

type Phase = "processing" | "failed" | "timeout" | "awaiting_fulfillment"

type ManualStatus = "AWAITING_FULFILLMENT" | "PROCESSING"

type Props = {
    orderNo: string
    etaText?: string
}

export function AwaitingPaymentClient({ orderNo, etaText }: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get("token") ?? ""
    const [phase, setPhase] = useState<Phase>("processing")
    const [manualStatus, setManualStatus] = useState<ManualStatus | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const attemptRef = useRef(0)

    useEffect(() => {
        if (!token) {
            router.replace(`/orders/lookup?orderNo=${encodeURIComponent(orderNo)}`)
            return
        }

        const tick = async () => {
            const attempt = attemptRef.current
            let status: string | null = null
            let expired = false

            try {
                const res = await fetch(
                    `/api/orders/${encodeURIComponent(orderNo)}/payment-status?token=${encodeURIComponent(token)}`,
                    { cache: "no-store" },
                )
                if (res.status === 401) {
                    expired = true
                } else if (res.ok) {
                    const data = (await res.json()) as { status: string }
                    status = data.status
                }
                // 429 / 5xx / network: status stays null → retry below
            } catch {
                // network error: retry
            }

            if (expired) {
                setPhase("timeout")
                return
            }

            if (status === "COMPLETED") {
                router.replace(
                    `/orders/${encodeURIComponent(orderNo)}/success?token=${encodeURIComponent(token)}`,
                )
                return
            }

            if (status === "CLOSED") {
                setPhase("failed")
                return
            }

            // MANUAL paid path: payment confirmed, but admin must still fulfill.
            // Hand off to the awaiting_fulfillment branch — the FulfillmentPoller
            // sub-component below picks up at a slower cadence (30s) via
            // useManualStatusPoll and will redirect to /success on COMPLETED.
            if (status === "AWAITING_FULFILLMENT" || status === "PROCESSING") {
                setManualStatus(status)
                setPhase("awaiting_fulfillment")
                return
            }

            // PENDING or transient error: schedule next attempt
            if (attempt >= POLL_SCHEDULE.length) {
                setPhase("timeout")
                return
            }
            attemptRef.current = attempt + 1
            timerRef.current = setTimeout(tick, POLL_SCHEDULE[attempt])
        }

        void tick()

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [orderNo, token, router])

    if (phase === "processing") {
        return (
            <Card>
                <CardContent className="py-8 flex flex-col items-center gap-4 text-center">
                    <Loader2 className="size-10 animate-spin text-primary" />
                    <div>
                        <p className="text-lg font-semibold">正在确认支付结果</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            请稍候，系统正在处理中，通常不超过 1 分钟
                        </p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (phase === "awaiting_fulfillment" && manualStatus) {
        return (
            <FulfillmentPoller
                orderNo={orderNo}
                token={token}
                initialStatus={manualStatus}
                etaText={etaText}
            />
        )
    }

    if (phase === "failed") {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="size-5" />
                        <CardTitle>订单已关闭</CardTitle>
                    </div>
                    <CardDescription>
                        该订单已被关闭，如有疑问请查询订单详情或联系客服
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                    <Button asChild>
                        <Link href={`/orders/lookup?orderNo=${encodeURIComponent(orderNo)}`}>
                            查询订单
                        </Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/">返回首页</Link>
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>支付结果未知</CardTitle>
                <CardDescription>
                    系统无法确认支付结果，请通过订单号查询。若已付款，卡密将在支付确认后自动发送到您的邮箱。
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                <Button asChild>
                    <Link href={`/orders/lookup?orderNo=${encodeURIComponent(orderNo)}`}>
                        查询订单
                    </Link>
                </Button>
                <Button asChild variant="outline">
                    <Link href="/">返回首页</Link>
                </Button>
            </CardContent>
        </Card>
    )
}

/**
 * Owns the long-running MANUAL status poll once payment has been
 * confirmed. Visibility-aware and capped at 30 minutes via the shared
 * hook — falls back to a manual-refresh CTA after timeout.
 */
function FulfillmentPoller({
    orderNo,
    token,
    initialStatus,
    etaText,
}: {
    orderNo: string
    token: string
    initialStatus: ManualStatus
    etaText?: string
}) {
    const router = useRouter()
    const { status, phase } = useManualStatusPoll(orderNo, token)
    // Prefer the live polled status (it may advance AWAITING_FULFILLMENT
    // → PROCESSING) but fall back to the initial handoff value before
    // the first poll lands.
    const displayStatus: ManualStatus =
        status === "AWAITING_FULFILLMENT" || status === "PROCESSING"
            ? status
            : initialStatus

    useEffect(() => {
        if (phase === "fulfilled") {
            router.replace(
                `/orders/${encodeURIComponent(orderNo)}/success?token=${encodeURIComponent(token)}`,
            )
        }
    }, [phase, orderNo, token, router])

    if (phase === "closed") {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="size-5" />
                        <CardTitle>订单已关闭</CardTitle>
                    </div>
                    <CardDescription>
                        该订单已被关闭，如有疑问请查询订单详情或联系客服
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                    <Button asChild>
                        <Link href={`/orders/lookup?orderNo=${encodeURIComponent(orderNo)}`}>
                            查询订单
                        </Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/">返回首页</Link>
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>支付已完成，等待发货</CardTitle>
                <CardDescription>
                    卖家收到通知后会尽快为您发货，发货后页面会自动跳转，无需手动刷新。
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <ManualStatusTimeline current={displayStatus} etaText={etaText} />
                {phase === "stopped_timeout" && (
                    <p className="text-xs text-muted-foreground">
                        长时间未发货，自动检测已暂停。请刷新页面或前往订单查询以获取最新状态。
                    </p>
                )}
                <div className="flex flex-col gap-2">
                    <Button asChild>
                        <Link href={`/orders/lookup?orderNo=${encodeURIComponent(orderNo)}`}>
                            查询订单 / 催发货
                        </Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/">返回首页</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
