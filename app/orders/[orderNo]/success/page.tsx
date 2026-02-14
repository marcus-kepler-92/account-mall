import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { verifyOrderSuccessToken } from "@/lib/order-success-token"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, Mail, Hash, AlertCircle } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { OrderSuccessCopySection } from "@/app/components/order-success-copy-section"
import { OrderSuccessSyncHistory } from "@/app/components/order-success-sync-history"

type PageProps = {
    params: Promise<{ orderNo: string }>
    searchParams: Promise<{ token?: string }>
}

export const dynamic = "force-dynamic"

export default async function OrderSuccessPage({ params, searchParams }: PageProps) {
    const { orderNo } = await params
    const { token } = await searchParams

    if (!token || !verifyOrderSuccessToken(orderNo, token)) {
        return (
            <div className="flex min-h-screen flex-col">
                <SiteHeader />
                <main className="flex-1 px-4 py-12">
                    <div className="mx-auto max-w-md">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2 text-destructive">
                                    <AlertCircle className="size-5" />
                                    <CardTitle>验证失效</CardTitle>
                                </div>
                                <CardDescription>
                                    链接已过期或无效，请使用订单号和查询密码重新查询
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button asChild className="w-full">
                                    <Link href="/orders/lookup">去订单查询</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
        )
    }

    const order = await prisma.order.findFirst({
        where: { orderNo },
        include: {
            product: { select: { name: true } },
            cards: {
                where: { status: { in: ["SOLD", "RESERVED"] } },
                select: { content: true },
            },
        },
    })

    if (!order) notFound()
    if (order.status !== "COMPLETED") {
        return (
            <div className="flex min-h-screen flex-col">
                <SiteHeader />
                <main className="flex-1 px-4 py-12">
                    <div className="mx-auto max-w-md">
                        <Card>
                            <CardHeader>
                                <CardTitle>订单未完成</CardTitle>
                                <CardDescription>
                                    当前订单状态为「{order.status === "PENDING" ? "待支付" : "已关闭"}」，无法查看卡密
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button asChild variant="outline" className="w-full">
                                    <Link href="/orders/lookup">返回订单查询</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
        )
    }

    const cards = order.cards.map((c) => c.content)
    const productName = order.product?.name ?? "商品"

    return (
        <div className="flex min-h-screen flex-col">
            <OrderSuccessSyncHistory orderNo={orderNo} />
            <SiteHeader />
            <main className="flex-1 px-4 py-8">
                <div className="mx-auto max-w-2xl space-y-6">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold">支付成功</h1>
                        <p className="mt-1 text-muted-foreground">
                            {productName} · 订单号 {orderNo}
                        </p>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="size-5" />
                                卡密信息
                            </CardTitle>
                            <CardDescription>
                                共 {cards.length} 条，请妥善保存。建议保存订单号和查询密码以便日后查询。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <OrderSuccessCopySection cards={cards} />
                            <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                                <p className="flex items-center gap-2">
                                    <Hash className="size-4 shrink-0" />
                                    请保存订单号与查询密码，后续可在「订单查询」中重新查看卡密
                                </p>
                                <p className="mt-2 flex items-center gap-2">
                                    <Mail className="size-4 shrink-0" />
                                    卡密已发送至下单邮箱，请查收备份
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-center">
                        <Button asChild variant="outline">
                            <Link href="/">返回首页</Link>
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    )
}

function Package(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d="M16.5 9.4 7.55 4.24" />
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" x2="12" y1="22.08" y2="12" />
        </svg>
    )
}
