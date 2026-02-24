import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { processYipayNotifyAndComplete } from "@/lib/yipay-notify-complete"
import { createOrderSuccessToken } from "@/lib/order-success-token"

export const dynamic = "force-dynamic"

/**
 * 支付同步返回页（return_url）. 易支付/支付宝支付完成后会跳转至此。
 * 若 URL 带签名参数且为成功状态，在此完成订单（与异步 notify 逻辑一致，幂等）；
 * 成功则重定向到成功页（带一次性 token），由成功页同步本地订单状态，避免暴露未鉴权的状态接口。
 */
export default async function PayReturnPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const hasYipayParams = params?.out_trade_no && params?.sign && params?.trade_status
    if (hasYipayParams && typeof params.out_trade_no === "string" && typeof params.sign === "string") {
        const postData: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(params)) {
            const val = Array.isArray(v) ? v[0] : v
            postData[k] = val ?? ""
        }
        const result = await processYipayNotifyAndComplete(postData).catch(() => ({ ok: false }))
        const orderNo =
            typeof params.out_trade_no === "string"
                ? params.out_trade_no
                : Array.isArray(params.out_trade_no)
                  ? params.out_trade_no[0]
                  : undefined
        if (result?.ok && orderNo) {
            const token = createOrderSuccessToken(orderNo)
            if (token) redirect(`/orders/${encodeURIComponent(orderNo)}/success?token=${encodeURIComponent(token)}`)
            // No token (e.g. secret not configured): redirect to lookup so user lands on query step;
            // if same browser, sessionStorage prefill from order form will auto-run and show 卡密
            redirect(`/orders/lookup?orderNo=${encodeURIComponent(orderNo)}&fromPay=1`)
        }
    }

    const orderNo =
        typeof params?.out_trade_no === "string"
            ? params.out_trade_no
            : Array.isArray(params?.out_trade_no)
              ? params.out_trade_no[0]
              : undefined
    const lookupHref = orderNo ? `/orders/lookup?orderNo=${encodeURIComponent(orderNo)}` : "/orders/lookup"

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
