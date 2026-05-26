import Link from "next/link"
import { Hash, Mail, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { SiteHeader } from "@/app/components/site-header"
import { OrderSuccessSyncHistory } from "./order-success-sync-history"
import { OrderCompletedTracker } from "./order-completed-tracker"
import { CrossSellSection } from "./cross-sell-section"
import type { ComponentProps, ReactNode } from "react"

type CrossSellProps = ComponentProps<typeof CrossSellSection>

type Props = {
    orderId: string
    orderNo: string
    productName: string
    amount: number
    cardsCount: number
    cs?: string | null
    /** Pre-resolved cross-sell payload. Null/undefined → section omitted. */
    crossSell?: CrossSellProps | null
    /** Card-section content provided by the per-productType caller. */
    children: ReactNode
}

/**
 * Shared success-page outer shell for COMPLETED Card-based orders
 * (NORMAL + AUTO_FETCH). Renders the header / order-info card frame /
 * cross-sell / footer CTA; the caller injects the card-display slot
 * specific to their productType.
 *
 * MANUAL has its own dedicated view (ManualSuccessView) and does NOT
 * use this shell — its layout, timeline, and CTAs diverge enough that
 * sharing a frame would force conditional props throughout.
 */
export function SuccessShell({
    orderId,
    orderNo,
    productName,
    amount,
    cardsCount,
    cs,
    crossSell,
    children,
}: Props) {
    const isFree = amount === 0
    const title = isFree ? "领取成功" : "支付成功"

    return (
        <div className="flex min-h-screen flex-col">
            <OrderSuccessSyncHistory orderNo={orderNo} />
            <OrderCompletedTracker
                orderId={orderId}
                orderNo={orderNo}
                productName={productName}
                amount={amount}
                isFree={isFree}
            />
            <SiteHeader cs={cs} />
            <main className="flex-1 py-8">
                <div className="mx-auto max-w-2xl space-y-4 px-4 pb-8">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold">{title}</h1>
                        <p className="mt-1 text-muted-foreground">
                            {productName} · 订单号 {orderNo}
                        </p>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="size-5" />
                                账号信息
                            </CardTitle>
                            <CardDescription>
                                共 {cardsCount} 条，请妥善保存。建议保存订单号和查询密码以便日后查询。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {children}
                            <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                                <p className="flex items-center gap-2">
                                    <Hash className="size-4 shrink-0" />
                                    请保存订单号与查询密码，后续可在「订单查询」中重新查看卡密
                                </p>
                                <p className="mt-2 flex items-center gap-2">
                                    <Mail className="size-4 shrink-0" />
                                    卡密已发送至下单邮箱，请查收备份(不一定收到，可前往订单查询中查看)
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {crossSell && crossSell.recommendations.length > 0 && (
                        <CrossSellSection {...crossSell} />
                    )}
                </div>

                <div className="flex justify-center px-4 pb-8">
                    <Button asChild variant="outline">
                        <Link href="/">返回首页</Link>
                    </Button>
                </div>
            </main>
        </div>
    )
}
