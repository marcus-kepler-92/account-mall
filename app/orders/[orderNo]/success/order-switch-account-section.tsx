"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeftRight, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import type { AutoFetchCardPayload } from "@/lib/auto-fetch-card"

type Props = {
    orderNo: string
    onSwitched: (payload: AutoFetchCardPayload) => void
}

export function OrderSwitchAccountSection({ orderNo, onSwitched }: Props) {
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSwitch = useCallback(async () => {
        if (!password) return
        setLoading(true)
        try {
            const res = await fetch(`/api/orders/${encodeURIComponent(orderNo)}/switch-account`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
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
            setLoading(false)
        }
    }, [orderNo, password, onSwitched])

    return (
        <div className="border-t pt-4 space-y-2">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
                账号无法正常使用？可更换一次。
            </p>
            <div className="flex gap-2">
                <Input
                    type="password"
                    placeholder="输入下单时设置的查询密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSwitch()}
                    className="flex-1 min-w-0 text-sm"
                />
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    disabled={loading || !password}
                    onClick={handleSwitch}
                >
                    <ArrowLeftRight className={`size-3.5 ${loading ? "animate-pulse" : ""}`} />
                    {loading ? "切换中…" : "更换账号"}
                </Button>
            </div>
        </div>
    )
}
