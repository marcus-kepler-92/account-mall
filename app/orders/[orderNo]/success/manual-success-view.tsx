"use client"

import Link from "next/link"
import { Copy, Mail } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { SiteHeader } from "@/app/components/site-header"
import { ManualStatusTimeline } from "@/app/orders/[orderNo]/manual-status-timeline"
import { formatCurrency } from "@/lib/utils"

type Props = {
    orderNo: string
    status: "AWAITING_FULFILLMENT" | "PROCESSING" | "COMPLETED"
    productName: string
    variantName: string | null
    amount: number
    email: string
    etaText: string
    cs?: string
}

// Mask the buyer email for display (e.g. "k***le@gmail.com"). Showing the full
// address feels invasive on a public page; this preserves enough to confirm the
// right inbox without leaking the full identifier.
function maskEmail(email: string): string {
    const [local, domain] = email.split("@")
    if (!local || !domain) return email
    if (local.length <= 2) return `${local[0]}*@${domain}`
    return `${local[0]}***${local[local.length - 1]}@${domain}`
}

/**
 * Buyer-facing success view for MANUAL products. Renders in place of the
 * cards-centric layout (which doesn't apply — MANUAL fulfillment happens
 * out-of-band by admin and the order sits in AWAITING_FULFILLMENT after
 * payment). Includes a timeline, ETA from business-hours, and a lookup CTA
 * so the buyer can revisit / dun without needing the success token URL.
 *
 * COMPLETED orders also render this view: the timeline shows the final state
 * and the CTA labels shift to "查看发货内容" to take the buyer to lookup where
 * the cards live.
 */
export function ManualSuccessView({
    orderNo,
    status,
    productName,
    variantName,
    amount,
    email,
    etaText,
    cs,
}: Props) {
    const isCompleted = status === "COMPLETED"
    const title = isCompleted ? "卖家已发货" : "下单成功，等待卖家发货"
    const subtitle = isCompleted
        ? "已完成 · 请到订单查询查看发货内容"
        : "支付已成功 · 卖家会在工作时间内为你处理"

    const lookupHref = `/orders/lookup?orderNo=${encodeURIComponent(orderNo)}`

    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader cs={cs} />
            <main className="flex-1 py-8">
                <div className="mx-auto max-w-2xl space-y-4 px-4 pb-8">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold">{title}</h1>
                        <p className="mt-1 text-muted-foreground">{subtitle}</p>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>订单信息</CardTitle>
                            <CardDescription>
                                请保存订单号，后续可在「订单查询」中重新查看进度
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                                <dt className="text-muted-foreground">订单号</dt>
                                <dd className="flex items-center gap-2 font-mono tabular-nums">
                                    <span className="truncate">{orderNo}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-5 shrink-0 text-muted-foreground"
                                        onClick={() => {
                                            navigator.clipboard.writeText(orderNo)
                                            toast.success("订单号已复制")
                                        }}
                                        aria-label="复制订单号"
                                    >
                                        <Copy className="size-3" />
                                    </Button>
                                </dd>
                                <dt className="text-muted-foreground">商品</dt>
                                <dd className="truncate">{productName}</dd>
                                {variantName && (
                                    <>
                                        <dt className="text-muted-foreground">规格</dt>
                                        <dd className="truncate">{variantName}</dd>
                                    </>
                                )}
                                <dt className="text-muted-foreground">金额</dt>
                                <dd className="tabular-nums">{formatCurrency(amount)}</dd>
                            </dl>

                            <div className="rounded-lg border bg-muted/30 p-3">
                                <ManualStatusTimeline
                                    current={status}
                                    etaText={isCompleted ? undefined : etaText}
                                />
                            </div>

                            <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                                <p className="flex items-center gap-2">
                                    <Mail className="size-4 shrink-0" />
                                    {isCompleted
                                        ? `发货邮件已发送至 ${maskEmail(email)}`
                                        : `发货完成时会邮件通知 ${maskEmail(email)}`}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
                        <Button asChild>
                            <Link href={lookupHref}>
                                {isCompleted ? "查看发货内容" : "查看订单详情"}
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/">返回商城</Link>
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    )
}
