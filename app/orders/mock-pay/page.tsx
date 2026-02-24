"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteHeader } from "@/app/components/site-header"
import { Loader2, CreditCard, AlertCircle } from "lucide-react"
import { toast } from "sonner"

function MockPayContent() {
    const searchParams = useSearchParams()
    const orderNo = searchParams.get("orderNo") ?? ""
    const amount = searchParams.get("amount") ?? ""

    const [loading, setLoading] = useState(false)

    const handlePay = async () => {
        if (!orderNo) {
            toast.error("缺少订单号")
            return
        }
        setLoading(true)
        try {
            const res = await fetch("/api/dev/complete-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderNo }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(data?.error ?? "操作失败")
                setLoading(false)
                return
            }
            if (data.redirectUrl) {
                toast.success("支付成功，正在跳转…")
                window.location.href = data.redirectUrl
                return
            }
            toast.error("无法跳转")
        } catch {
            toast.error("请求失败")
        } finally {
            setLoading(false)
        }
    }

    if (!orderNo) {
        return (
            <div className="flex min-h-screen flex-col">
                <SiteHeader />
                <main className="flex-1 px-4 py-12">
                    <div className="mx-auto max-w-md">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-destructive">
                                    <AlertCircle className="size-5" />
                                    链接无效
                                </CardTitle>
                                <CardDescription>缺少订单号，请从商品页重新下单。</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button asChild variant="outline" className="w-full">
                                    <Link href="/">返回首页</Link>
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1 px-4 py-12">
                <div className="mx-auto max-w-md">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="size-5" />
                                模拟支付
                            </CardTitle>
                            <CardDescription>
                                仅开发环境使用。订单号：{orderNo}
                                {amount ? ` · 金额 ¥${amount}` : ""}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                点击下方按钮将直接完成订单并跳转到卡密查看页。
                            </p>
                            <Button
                                className="w-full gap-2"
                                onClick={handlePay}
                                disabled={loading}
                            >
                                {loading && (
                                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                                )}
                                {loading ? "处理中…" : "确认支付"}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}

export default function MockPayPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen flex-col">
                    <SiteHeader />
                    <main className="flex flex-1 items-center justify-center px-4 py-12">
                        <Loader2 className="size-8 animate-spin text-muted-foreground" />
                    </main>
                </div>
            }
        >
            <MockPayContent />
        </Suspense>
    )
}
