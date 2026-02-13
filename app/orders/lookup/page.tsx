import { Suspense } from "react"
import { notFound, redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

async function lookupOrder(formData: FormData) {
    "use server"

    const orderNo = (formData.get("orderNo") as string | null)?.trim() ?? ""
    const password = (formData.get("password") as string | null) ?? ""

    if (!orderNo || !password) {
        redirect(`/orders/lookup?error=${encodeURIComponent("订单号和查询密码不能为空")}&orderNo=${encodeURIComponent(orderNo)}`)
        return
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/orders/lookup`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderNo, password }),
        cache: "no-store",
    })

    if (!res.ok) {
        let message = "查询失败，请稍后重试"
        try {
            const data = await res.json()
            if (data?.error === "Order not found or password incorrect") {
                message = "订单不存在或密码错误"
            }
        } catch {
            // ignore JSON parse errors
        }

        redirect(`/orders/lookup?error=${encodeURIComponent(message)}&orderNo=${encodeURIComponent(orderNo)}`)
        return
    }

    const data = await res.json()

    if (!data || !data.orderNo) {
        redirect(`/orders/lookup?error=${encodeURIComponent("订单不存在或密码错误")}&orderNo=${encodeURIComponent(orderNo)}`)
        return
    }

    // Redirect to success page with order data in URL params or session
    // For now, redirect back with success flag
    redirect(`/orders/lookup?success=true&orderNo=${encodeURIComponent(data.orderNo)}`)
}

export default function OrderLookupPage({
    searchParams,
}: {
    searchParams: {
        orderNo?: string
        error?: string
        success?: string
    }
}) {
    // If NEXT_PUBLIC_APP_URL is not configured, this page should not be reachable in production.
    if (!process.env.NEXT_PUBLIC_APP_URL) {
        notFound()
    }

    return (
        <div className="container max-w-xl py-10">
            <Card>
                <CardHeader>
                    <CardTitle>订单查询</CardTitle>
                    <CardDescription>
                        请输入下单时生成的订单号和查询密码，我们会展示该订单下的卡密内容。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {searchParams.error && (
                        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                            {searchParams.error}
                        </div>
                    )}
                    {searchParams.success === "true" && (
                        <div className="rounded-lg border border-green-500 bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                            查询成功！订单号: {searchParams.orderNo}
                        </div>
                    )}
                    <Suspense fallback={null}>
                        {/* Simple server action based form; errors are returned inline. */}
                        {/* In a real app you might want to convert this to a Client Component with better UX. */}
                        <form action={lookupOrder} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium" htmlFor="orderNo">
                                    订单号
                                </label>
                                <Input
                                    id="orderNo"
                                    name="orderNo"
                                    placeholder="例如：FAK2024021300001"
                                    defaultValue={searchParams.orderNo ?? ""}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium" htmlFor="password">
                                    查询密码
                                </label>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="下单时设置的查询密码"
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full">
                                查询订单
                            </Button>
                        </form>
                    </Suspense>
                </CardContent>
            </Card>
        </div>
    )
}

