"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/app/components/theme-toggle"
import { Zap, Search, Copy, Check, Loader2, Mail, Hash } from "lucide-react"
import { toast } from "sonner"

interface OrderResult {
    orderNo: string
    productName: string
    createdAt: string
    status: "PENDING" | "COMPLETED" | "CLOSED"
    cards: Array<{ content: string }>
}

type LookupMode = "orderNo" | "email"

export default function OrderLookupPage() {
    const [lookupMode, setLookupMode] = useState<LookupMode>("orderNo")
    const [orderNo, setOrderNo] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<OrderResult | null>(null)
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        setResult(null)

        if (lookupMode === "orderNo") {
            if (!orderNo.trim() || !password.trim()) {
                setError("订单号和查询密码不能为空")
                return
            }
        } else {
            if (!email.trim() || !password.trim()) {
                setError("邮箱和查询密码不能为空")
                return
            }
        }

        setLoading(true)

        try {
            const apiEndpoint = lookupMode === "orderNo" ? "/api/orders/lookup" : "/api/orders/lookup-by-email"
            const requestBody =
                lookupMode === "orderNo"
                    ? {
                          orderNo: orderNo.trim(),
                          password: password.trim(),
                      }
                    : {
                          email: email.trim().toLowerCase(),
                          password: password.trim(),
                      }

            const res = await fetch(apiEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            })

            if (!res.ok) {
                let message = "查询失败，请稍后重试"
                try {
                    const data = await res.json()
                    if (data?.error === "Order not found or password incorrect") {
                        message = "订单不存在或密码错误"
                    } else if (data?.error) {
                        message = data.error
                    }
                } catch {
                    // ignore JSON parse errors
                }
                setError(message)
                setLoading(false)
                return
            }

            const data = await res.json()

            if (!data || !data.orderNo) {
                setError("订单不存在或密码错误")
                setLoading(false)
                return
            }

            setResult(data)
            setLoading(false)
        } catch (err) {
            setError("网络错误，请稍后重试")
            setLoading(false)
        }
    }

    const copyCard = async (content: string, index: number) => {
        try {
            await navigator.clipboard.writeText(content)
            setCopiedIndex(index)
            toast.success("卡密已复制")
            setTimeout(() => setCopiedIndex(null), 2000)
        } catch (err) {
            toast.error("复制失败，请手动复制")
        }
    }

    const copyAllCards = async () => {
        if (!result || result.cards.length === 0) return

        const allCards = result.cards.map((card) => card.content).join("\n")
        try {
            await navigator.clipboard.writeText(allCards)
            toast.success(`已复制 ${result.cards.length} 条卡密`)
        } catch (err) {
            toast.error("复制失败，请手动复制")
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "COMPLETED":
                return <Badge variant="default">已完成</Badge>
            case "PENDING":
                return <Badge variant="secondary">待支付</Badge>
            case "CLOSED":
                return <Badge variant="outline">已关闭</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    return (
        <div className="flex min-h-screen flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
                            <Zap className="size-4 text-primary-foreground" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">Account Mall</span>
                    </Link>
                    <nav className="flex items-center gap-2">
                        <ThemeToggle />
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/orders/lookup">
                                <Search className="size-4" />
                                订单查询
                            </Link>
                        </Button>
                    </nav>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1">
                <div className="mx-auto max-w-2xl px-4 py-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>订单查询</CardTitle>
                            <CardDescription>
                                请输入下单时生成的订单号和查询密码，我们会展示该订单下的卡密内容。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Error message */}
                            {error && (
                                <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                                    {error}
                                </div>
                            )}

                            {/* Lookup mode selector */}
                            <div className="flex gap-2 rounded-lg border p-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLookupMode("orderNo")
                                        setError(null)
                                        setResult(null)
                                    }}
                                    className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                                        lookupMode === "orderNo"
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-accent"
                                    }`}
                                >
                                    <Hash className="size-4" />
                                    订单号查询
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLookupMode("email")
                                        setError(null)
                                        setResult(null)
                                    }}
                                    className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                                        lookupMode === "email"
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-accent"
                                    }`}
                                >
                                    <Mail className="size-4" />
                                    邮箱查询
                                </button>
                            </div>

                            {/* Query form */}
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {lookupMode === "orderNo" ? (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium" htmlFor="orderNo">
                                            订单号
                                        </label>
                                        <Input
                                            id="orderNo"
                                            name="orderNo"
                                            placeholder="例如：FAK2024021300001"
                                            value={orderNo}
                                            onChange={(e) => setOrderNo(e.target.value)}
                                            disabled={loading}
                                            required
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium" htmlFor="email">
                                            邮箱地址
                                        </label>
                                        <Input
                                            id="email"
                                            name="email"
                                            type="email"
                                            placeholder="例如：user@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            disabled={loading}
                                            required
                                        />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium" htmlFor="password">
                                        查询密码
                                    </label>
                                    <Input
                                        id="password"
                                        name="password"
                                        type="password"
                                        placeholder="下单时设置的查询密码"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={loading}
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 size-4 animate-spin" />
                                            查询中...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="mr-2 size-4" />
                                            查询订单
                                        </>
                                    )}
                                </Button>
                            </form>

                            {/* Order result */}
                            {result && (
                                <div className="space-y-4 border-t pt-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold">订单信息</h3>
                                        {getStatusBadge(result.status)}
                                    </div>

                                    <div className="grid gap-4 rounded-lg border bg-muted/50 p-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">订单号</span>
                                            <span className="font-mono text-sm font-medium">{result.orderNo}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">商品名称</span>
                                            <span className="text-sm font-medium">{result.productName}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">创建时间</span>
                                            <span className="text-sm">{formatDate(result.createdAt)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">卡密数量</span>
                                            <span className="text-sm font-medium">{result.cards.length} 条</span>
                                        </div>
                                    </div>

                                    {/* Cards list */}
                                    {result.cards.length > 0 && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-semibold">卡密内容</h3>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={copyAllCards}
                                                    className="gap-2"
                                                >
                                                    <Copy className="size-4" />
                                                    复制全部
                                                </Button>
                                            </div>
                                            <div className="space-y-2">
                                                {result.cards.map((card, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-center gap-2 rounded-lg border bg-background p-3"
                                                    >
                                                        <code className="flex-1 font-mono text-sm">
                                                            {card.content}
                                                        </code>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8 shrink-0"
                                                            onClick={() => copyCard(card.content, index)}
                                                            aria-label={`复制第 ${index + 1} 条卡密`}
                                                        >
                                                            {copiedIndex === index ? (
                                                                <Check className="size-4 text-green-600" />
                                                            ) : (
                                                                <Copy className="size-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tips */}
                                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                                        <p className="font-medium mb-1">温馨提示：</p>
                                        <ul className="list-disc list-inside space-y-1 text-xs">
                                            <li>请妥善保管订单号和查询密码</li>
                                            <li>卡密内容请及时保存，避免丢失</li>
                                            <li>如有问题，请联系客服</li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t">
                <div className="mx-auto max-w-6xl px-4 py-8">
                    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                        <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-start">
                            <div className="flex items-center gap-2">
                                <div className="flex size-6 items-center justify-center rounded-md bg-primary">
                                    <Zap className="size-3 text-primary-foreground" />
                                </div>
                                <span className="text-sm font-medium">Account Mall</span>
                            </div>
                            <nav className="flex gap-4 text-sm text-muted-foreground">
                                <Link href="/orders/lookup" className="hover:text-foreground transition-colors">
                                    订单查询
                                </Link>
                            </nav>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            &copy; {new Date().getFullYear()} Account Mall 版权所有
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
