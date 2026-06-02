import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { formatDateTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CreditCard, ShoppingCart, TrendingUp } from "lucide-react"
import { resolveAdminCard } from "@/lib/card-format"
import { resolveOrderCost } from "@/lib/profit"
import { cn } from "@/lib/utils"
import { OrderCardsTable } from "@/app/admin/(main)/orders/[orderId]/order-cards-table"
import { ManualFulfillmentPanel } from "@/app/admin/(main)/orders/[orderId]/manual-fulfillment-panel"
import { OrderCostEditor } from "@/app/admin/(main)/orders/[orderId]/order-cost-editor"

export const dynamic = "force-dynamic"

type PageProps = {
    params: Promise<{ orderId: string }>
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
    const { orderId } = await params

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            product: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    productType: true,
                    cardTemplates: {
                        orderBy: { sortOrder: "asc" },
                        select: { template: true },
                    },
                },
            },
            cards: {
                orderBy: { createdAt: "asc" },
            },
            fulfillment: {
                select: { content: true },
            },
            commissions: {
                where: { status: { not: "CANCELLED" } },
                select: { amount: true, level: true },
            },
        },
    })

    if (!order) {
        notFound()
    }

    // Cost & profit ledger. Cost and commissions are only finalized on order
    // completion, so profit is computable only for COMPLETED orders that have
    // a recorded cost — otherwise we show "—" rather than a misleading number.
    const revenue = Number(order.amount)
    const { cost, hasCost } = resolveOrderCost(order)
    const commissionL1 = order.commissions
        .filter((c) => c.level === 1)
        .reduce((s, c) => s + Number(c.amount), 0)
    const commissionL2 = order.commissions
        .filter((c) => c.level === 2)
        .reduce((s, c) => s + Number(c.amount), 0)
    const totalCommission = commissionL1 + commissionL2
    const netProfit = revenue - cost - totalCommission
    const canComputeProfit = order.status === "COMPLETED" && hasCost
    const profitMargin =
        canComputeProfit && revenue > 0 ? (netProfit / revenue) * 100 : null
    const profitHint =
        order.status !== "COMPLETED"
            ? "成本与佣金在订单完成后结算"
            : !hasCost
              ? "未录入卡密成本，无法计算净利润"
              : null

    const statusLabel =
        order.status === "PENDING"
            ? "待完成"
            : order.status === "AWAITING_FULFILLMENT"
              ? "待发货"
              : order.status === "PROCESSING"
                ? "发货中"
                : order.status === "COMPLETED"
                  ? "已完成"
                  : order.status === "REFUNDED"
                    ? "已退款"
                    : "已关闭"

    const statusBadgeClass =
        order.status === "COMPLETED"
            ? "border-success/50 bg-success/10 text-success"
            : order.status === "PENDING" ||
                order.status === "AWAITING_FULFILLMENT" ||
                order.status === "PROCESSING"
              ? "border-warning/50 bg-warning/10 text-warning"
              : order.status === "REFUNDED"
                ? "border-destructive/50 bg-destructive/10 text-destructive"
                : "border-muted-foreground/30 bg-muted text-muted-foreground"

    const cardTemplates = order.product.cardTemplates
    const serializedCards = order.cards.map((c) => ({
        id: c.id,
        content: c.content,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        productId: order.product.id,
        resolved: resolveAdminCard(c.content, cardTemplates),
    }))

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/orders">
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <ShoppingCart className="size-6" />
                        <span className="font-mono text-lg">{order.orderNo}</span>
                    </h2>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        订单详情
                    </p>
                </div>
                <Badge variant="outline" className={statusBadgeClass}>
                    {statusLabel}
                </Badge>
            </div>

            {/* Order info */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">订单信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 text-sm">
                        <div>
                            <p className="text-muted-foreground">订单号</p>
                            <p className="font-mono font-medium">{order.orderNo}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">邮箱</p>
                            <p>{order.email}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">商品</p>
                            <p>
                                <Link
                                    href={`/admin/products/${order.product.id}`}
                                    className="font-medium hover:underline"
                                >
                                    {order.product.name}
                                </Link>
                                <span className="text-muted-foreground ml-1">
                                    /{order.product.slug}
                                </span>
                            </p>
                        </div>
                        {order.variantNameSnapshot && (
                            <div>
                                <p className="text-muted-foreground">SKU</p>
                                <p>{order.variantNameSnapshot}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-muted-foreground">数量</p>
                            <p>{order.quantity}</p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">金额</p>
                            <p className="font-medium">
                                ¥{Number(order.amount).toFixed(2)}
                            </p>
                        </div>
                        {order.unitPriceSnapshot != null && (
                            <div>
                                <p className="text-muted-foreground">原始单价</p>
                                <p>¥{Number(order.unitPriceSnapshot).toFixed(2)}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-muted-foreground">支付方式</p>
                            <p>
                                {order.paymentMethod === "wxpay"
                                    ? "微信支付"
                                    : order.paymentMethod === "qqpay"
                                      ? "QQ 钱包"
                                      : "支付宝"}
                            </p>
                        </div>
                        <div>
                            <p className="text-muted-foreground">创建时间</p>
                            <p>{formatDateTime(order.createdAt)}</p>
                        </div>
                        {order.paidAt && (
                            <div>
                                <p className="text-muted-foreground">支付时间</p>
                                <p>{formatDateTime(order.paidAt)}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Cost & profit */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="size-4" />
                        成本与利润
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2 sm:gap-y-4 md:grid-cols-4">
                        <div className="flex items-center justify-between gap-4 sm:block">
                            <p className="text-muted-foreground">营收</p>
                            <p className="font-mono font-medium">
                                ¥{revenue.toFixed(2)}
                            </p>
                        </div>
                        <div className="flex items-center justify-between gap-4 sm:block">
                            <p className="flex items-center gap-1 text-muted-foreground">
                                成本
                                <OrderCostEditor
                                    orderId={order.id}
                                    cost={hasCost ? cost : null}
                                    editable={order.status === "COMPLETED"}
                                />
                            </p>
                            <p className="font-mono font-medium">
                                {hasCost ? (
                                    `−¥${cost.toFixed(2)}`
                                ) : (
                                    <span className="font-normal text-muted-foreground">
                                        未录入
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="flex items-start justify-between gap-4 sm:block">
                            <p className="text-muted-foreground">分销佣金</p>
                            <div className="text-right sm:text-left">
                                <p className="font-mono font-medium">
                                    −¥{totalCommission.toFixed(2)}
                                </p>
                                {totalCommission > 0 && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        直推 ¥{commissionL1.toFixed(2)}
                                        {commissionL2 > 0 &&
                                            ` · 下线 ¥${commissionL2.toFixed(2)}`}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 border-t pt-3 sm:block sm:border-t-0 sm:pt-0">
                            <p className="font-medium text-muted-foreground sm:font-normal">
                                净利润
                            </p>
                            <p
                                className={cn(
                                    "font-mono font-semibold",
                                    canComputeProfit &&
                                        netProfit > 0 &&
                                        "text-success",
                                    canComputeProfit &&
                                        netProfit < 0 &&
                                        "text-destructive",
                                )}
                            >
                                {canComputeProfit
                                    ? `¥${netProfit.toFixed(2)}`
                                    : "—"}
                                {profitMargin != null && (
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                                        利润率 {profitMargin.toFixed(1)}%
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    {profitHint && (
                        <p className="text-muted-foreground mt-3 text-xs">
                            {profitHint}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Manual fulfillment */}
            {order.product.productType === "MANUAL" && (
                <ManualFulfillmentPanel
                    orderId={order.id}
                    status={
                        order.status as
                            | "AWAITING_FULFILLMENT"
                            | "PROCESSING"
                            | "COMPLETED"
                            | "CLOSED"
                    }
                    existingContent={order.fulfillment?.content ?? null}
                    dunCount={order.dunCount}
                    lastDunAt={order.lastDunAt?.toISOString() ?? null}
                />
            )}

            {/* Cards */}
            {order.product.productType !== "MANUAL" && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <CreditCard className="size-4" />
                            卡密（{serializedCards.length} 条）
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <OrderCardsTable cards={serializedCards} />
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
