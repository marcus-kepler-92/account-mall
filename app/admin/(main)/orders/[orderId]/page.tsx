import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { formatDateTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CreditCard, ShoppingCart } from "lucide-react"
import { resolveAdminCard } from "@/lib/card-format"
import { OrderCardsTable } from "@/app/admin/(main)/orders/[orderId]/order-cards-table"

export const dynamic = "force-dynamic"

const MASK_LEN = 8

function maskContent(content: string) {
    if (content.length <= MASK_LEN) return content
    return content.slice(0, MASK_LEN) + "***"
}

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
                    cardTemplates: {
                        orderBy: { sortOrder: "asc" },
                        select: { template: true },
                    },
                },
            },
            cards: {
                orderBy: { createdAt: "asc" },
            },
        },
    })

    if (!order) {
        notFound()
    }

    const statusLabel =
        order.status === "PENDING"
            ? "待完成"
            : order.status === "COMPLETED"
              ? "已完成"
              : "已关闭"

    const cardTemplates = order.product.cardTemplates
    const serializedCards = order.cards.map((c) => ({
        id: c.id,
        content: c.content,
        maskedContent: maskContent(c.content),
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
                <Badge
                    variant="outline"
                    className={
                        order.status === "COMPLETED"
                            ? "border-success/50 bg-success/10 text-success"
                            : order.status === "PENDING"
                              ? "border-warning/50 bg-warning/10 text-warning"
                              : "border-muted-foreground/30 bg-muted text-muted-foreground"
                    }
                >
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

            {/* Cards */}
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
        </div>
    )
}
