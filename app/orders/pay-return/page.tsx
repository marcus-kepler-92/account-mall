import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { verifyZpayNotifySign } from "@/lib/zpay"
import { processZpayNotifyAndComplete } from "@/lib/zpay-notify-complete"
import { createOrderSuccessToken } from "@/lib/order-success-token"
import type { Metadata } from "next"

export const dynamic = "force-dynamic"

// Payment-return landing is a transient redirect target — keep it out of the index.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

/**
 * 支付同步返回页（return_url）. z-pay/支付宝支付完成后会跳转至此。
 *
 * Security: only issues order-success-token when Zpay sign is valid, so the
 * token capability (poll status + view cards) is gated on a legitimate payment
 * platform redirect rather than on knowledge of the orderNo alone.
 *
 * Flow:
 *   sign valid + processZpayNotifyAndComplete ok  → success page
 *   sign valid + not yet completed                 → awaiting-payment (active poll)
 *   sign invalid / no Zpay params                 → static fallback (order lookup link)
 */
export default async function PayReturnPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams

    const rawOrderNo = params?.out_trade_no
    const orderNo =
        typeof rawOrderNo === "string"
            ? rawOrderNo
            : Array.isArray(rawOrderNo)
              ? rawOrderNo[0]
              : undefined

    const hasZpayParams = !!(params?.out_trade_no && params?.sign && params?.trade_status)

    // Build postData for sign verification and processZpayNotifyAndComplete
    const postData: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(params ?? {})) {
        const val = Array.isArray(v) ? v[0] : v
        postData[k] = val ?? ""
    }

    // Security gate: verify Zpay signature independently before issuing any token.
    // Token capability (poll status + view cards) must be anchored to a legitimate
    // return_url from the payment platform, not just knowledge of an orderNo.
    let signValid = false
    if (hasZpayParams && orderNo) {
        signValid = verifyZpayNotifySign(postData)
    }

    if (signValid && orderNo) {
        // Fire-and-forget: attempt order completion via return_url params (idempotent with notify).
        // Does not gate routing — awaiting-payment polls for final status.
        void processZpayNotifyAndComplete(postData).catch(() => null)
        const token = createOrderSuccessToken(orderNo)
        if (token) {
            redirect(`/orders/${encodeURIComponent(orderNo)}/awaiting-payment?token=${encodeURIComponent(token)}`)
        }
        // Secret not configured: fall through to static fallback
    }

    // Static fallback: sign invalid, missing params, or secret not configured.
    // No token is issued — user must authenticate via order lookup (orderNo + password).
    const lookupHref = orderNo
        ? `/orders/lookup?orderNo=${encodeURIComponent(orderNo)}`
        : "/orders/lookup"

    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1 px-4 py-12">
                <div className="mx-auto max-w-md">
                    <Card>
                        <CardHeader>
                            <CardTitle>支付完成</CardTitle>
                            <CardDescription>
                                请前往「订单查询」输入订单号和查询密码查看卡密。卡密也会发送至您的邮箱。
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild className="w-full gap-2">
                                <Link href={lookupHref}>
                                    <Search className="size-4" />
                                    去订单查询
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}
