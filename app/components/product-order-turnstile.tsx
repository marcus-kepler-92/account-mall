"use client"

import { useRef, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useTurnstileStore } from "@/lib/stores/turnstile"
import type { TurnstileInstance } from "@marsidev/react-turnstile"

const Turnstile = dynamic(
    () => import("@marsidev/react-turnstile").then((m) => m.Turnstile),
    { ssr: false }
)

const MAX_AUTO_RETRIES = 3

type Props = {
    siteKey: string
}

export function ProductOrderTurnstile({ siteKey }: Props) {
    const ref = useRef<TurnstileInstance>(null)
    const retryCountRef = useRef(0)
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const { setToken, clearToken, setStatus, reset } = useTurnstileStore()
    const status = useTurnstileStore((s) => s.status)

    useEffect(() => {
        return () => {
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
            reset()
        }
    }, [reset])

    const handleError = useCallback((errorCode?: string) => {
        if (errorCode) console.warn("[Turnstile] Error:", errorCode)
        setStatus("error")
        clearToken()

        if (retryCountRef.current < MAX_AUTO_RETRIES) {
            retryCountRef.current++
            retryTimerRef.current = setTimeout(() => {
                ref.current?.reset()
            }, 5000)
        }
    }, [setStatus, clearToken])

    const handleManualRetry = () => {
        retryCountRef.current = 0
        ref.current?.reset()
    }

    return (
        <div>
            <Turnstile
                ref={ref}
                siteKey={siteKey}
                options={{
                    appearance: "interaction-only",
                    refreshExpired: "auto",
                    retry: "auto",
                    retryInterval: 3000,
                    size: "flexible",
                    language: "zh-CN",
                }}
                onSuccess={(token) => {
                    retryCountRef.current = 0
                    setToken(token)
                }}
                onExpire={() => {
                    clearToken()
                    setStatus("expired")
                }}
                onError={handleError}
                onTimeout={() => handleError("timeout")}
                onUnsupported={() => setStatus("unsupported")}
                onWidgetLoad={() => setStatus("loading")}
                onBeforeInteractive={() => setStatus("interactive")}
            />
            {status === "error" && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    <span>安全验证出错，正在重试…</span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-2 text-xs"
                        onClick={handleManualRetry}
                    >
                        <RefreshCw className="size-3" />
                        重试
                    </Button>
                </div>
            )}
            {status === "unsupported" && (
                <p className="mt-2 text-xs text-muted-foreground">
                    当前浏览器不支持安全验证，请使用系统浏览器打开本页面完成购买
                </p>
            )}
        </div>
    )
}
