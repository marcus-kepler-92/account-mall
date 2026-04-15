"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { RefreshCw, ArrowLeftRight, Clock, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import type { AutoFetchCardPayload } from "@/lib/auto-fetch-card"

type Props = {
    orderNo: string
    expiresAt: string | null
    token: string
    remainingSwitches: number
    onRefreshed: (payload: AutoFetchCardPayload) => void
    onSwitched: (payload: AutoFetchCardPayload) => void
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

export function OrderTroubleshootSection({
    orderNo,
    expiresAt,
    token,
    remainingSwitches,
    onRefreshed,
    onSwitched,
}: Props) {
    const remaining = useCountdown(expiresAt)
    const isExpired = expiresAt !== null && remaining !== null && remaining <= 0
    const [refreshLoading, setRefreshLoading] = useState(false)
    const [switchLoading, setSwitchLoading] = useState(false)
    const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)
    const anyLoading = refreshLoading || switchLoading
    const showSwitchStep = remainingSwitches > 0

    const handleRefresh = useCallback(async () => {
        setRefreshLoading(true)
        try {
            const res = await fetch(`/api/orders/${orderNo}/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || "获取失败，请稍后重试")
                return
            }
            if (data.refreshed && data.payload) {
                onRefreshed(data.payload)
                setLastRefreshedAt(data.refreshedAt)
                toast.success("已获取最新账号信息")
            } else {
                toast.error(data.error || "暂时无法获取，请稍后重试")
            }
        } catch {
            toast.error("网络异常，请稍后重试")
        } finally {
            setRefreshLoading(false)
        }
    }, [orderNo, token, onRefreshed])

    const handleSwitch = useCallback(async () => {
        setSwitchLoading(true)
        try {
            const res = await fetch(`/api/orders/${orderNo}/switch-account`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || "切换失败，请稍后重试")
                return
            }
            if (data.switched && data.payload) {
                onSwitched(data.payload)
                toast.success("已切换到新账号")
            }
        } catch {
            toast.error("网络异常，请稍后重试")
        } finally {
            setSwitchLoading(false)
        }
    }, [orderNo, token, onSwitched])

    return (
        <div className="border-t pt-4 space-y-3">
            {/* Countdown */}
            {expiresAt && (
                isExpired ? (
                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                        <AlertCircle className="size-3.5 shrink-0" />
                        已过期，请重新下单
                    </p>
                ) : (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3.5 shrink-0" />
                        <span>
                            可用时间：
                            <span className="ml-1 font-mono font-medium tabular-nums text-foreground">
                                {remaining !== null ? formatCountdown(remaining) : "—"}
                            </span>
                        </span>
                        {lastRefreshedAt && (
                            <span className="ml-auto flex items-center gap-1 text-green-600 dark:text-green-500">
                                <CheckCircle2 className="size-3" />
                                已于 {new Date(lastRefreshedAt).toLocaleTimeString("zh-CN", { timeZone: "Asia/Hong_Kong" })} 更新
                            </span>
                        )}
                    </div>
                )
            )}

            {/* Step 1: Refresh password */}
            {!isExpired && (
                <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground flex-1">
                        {showSwitchStep && "① "}密码登录失败？获取最新密码
                    </p>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1.5"
                        disabled={anyLoading}
                        onClick={handleRefresh}
                    >
                        <RefreshCw className={`size-3.5 ${refreshLoading ? "animate-spin" : ""}`} />
                        {refreshLoading ? "获取中…" : "刷新密码"}
                    </Button>
                </div>
            )}

            {/* Step 2: Switch account */}
            {!isExpired && showSwitchStep && (
                <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground flex-1">
                        ② 账号无法使用？更换账号（剩余 {remainingSwitches} 次）
                    </p>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="shrink-0 gap-1.5"
                                disabled={anyLoading}
                            >
                                <ArrowLeftRight
                                    className={`size-3.5 ${switchLoading ? "animate-pulse" : ""}`}
                                />
                                {switchLoading ? "切换中…" : "更换账号"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>确认更换账号？</AlertDialogTitle>
                                <AlertDialogDescription>
                                    更换后将分配新账号，当前账号将失效。剩余 {remainingSwitches} 次更换机会。
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={handleSwitch}>确认更换</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
        </div>
    )
}
