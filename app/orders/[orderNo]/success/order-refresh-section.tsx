"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Clock, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import type { AutoFetchCardPayload } from "@/lib/auto-fetch-card"

type Props = {
    orderNo: string
    expiresAt: string | null
    onRefreshed: (payload: AutoFetchCardPayload) => void
}

function useCountdown(expiresAt: string | null) {
    const [remaining, setRemaining] = useState<number | null>(null)
    useEffect(() => {
        if (!expiresAt) return
        const target = new Date(expiresAt).getTime()
        const update = () => setRemaining(Math.max(0, target - Date.now()))
        update()
        const id = setInterval(update, 1000)
        return () => clearInterval(id)
    }, [expiresAt])
    return remaining
}

function formatCountdown(ms: number): string {
    if (ms <= 0) return "已过期"
    const s = Math.floor(ms / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

export function OrderRefreshSection({ orderNo, expiresAt, onRefreshed }: Props) {
    const remaining = useCountdown(expiresAt)
    const isExpired = expiresAt !== null && remaining !== null && remaining <= 0
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)

    const handleRefresh = useCallback(async () => {
        if (!password) return
        setLoading(true)
        try {
            const res = await fetch(`/api/orders/${encodeURIComponent(orderNo)}/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || "获取失败，请稍后重试")
                return
            }
            if (data.refreshed && data.payload) {
                onRefreshed(data.payload)
                setLastRefreshedAt(data.refreshedAt)
                setPassword("")
                toast.success("已获取最新账号信息")
            } else {
                toast.error(data.error || "暂时无法获取，请稍后重试")
            }
        } catch {
            toast.error("网络异常，请稍后重试")
        } finally {
            setLoading(false)
        }
    }, [orderNo, password, onRefreshed])

    return (
        <div className="border-t pt-4 space-y-3">
            {/* 有效期 */}
            {expiresAt && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5 shrink-0" />
                    {isExpired ? (
                        <span className="flex items-center gap-1 text-destructive">
                            <AlertCircle className="size-3.5" />
                            已过期，请重新下单
                        </span>
                    ) : (
                        <span>
                            可用时间：
                            <span className="font-mono font-medium tabular-nums text-foreground ml-1">
                                {remaining !== null ? formatCountdown(remaining) : "—"}
                            </span>
                        </span>
                    )}
                    {lastRefreshedAt && (
                        <span className="ml-auto flex items-center gap-1 text-green-600 dark:text-green-500">
                            <CheckCircle2 className="size-3" />
                            已于 {new Date(lastRefreshedAt).toLocaleTimeString("zh-CN")} 更新
                        </span>
                    )}
                </div>
            )}

            {/* 获取最新密码 */}
            {!isExpired && (
                <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">密码登录失败？获取最新密码：</p>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            placeholder="输入下单时设置的订单密码"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleRefresh()}
                            className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 gap-1.5"
                            disabled={loading || !password}
                            onClick={handleRefresh}
                        >
                            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
                            {loading ? "获取中…" : "获取最新密码"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
