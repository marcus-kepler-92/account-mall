"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

const Turnstile = dynamic(
    () => import("@marsidev/react-turnstile").then((m) => m.Turnstile),
    { ssr: false }
)

type Props = {
    siteKey: string
    isAutoFetch: boolean
    widgetReady: boolean
    onWidgetReady: () => void
    onSuccess: (token: string) => void
    onExpire: () => void
}

export function ProductOrderTurnstile({
    siteKey,
    isAutoFetch,
    widgetReady,
    onWidgetReady,
    onSuccess,
    onExpire,
}: Props) {
    return (
        <div className="relative flex min-h-[76px] justify-center">
            {!widgetReady && (
                <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 px-4 py-3"
                    aria-hidden
                >
                    <Skeleton className="h-10 w-[200px] rounded-full" />
                    <p className="text-xs text-muted-foreground">
                        安全验证加载中… 完成后即可点击
                        {isAutoFetch ? "「领取」" : "「立即购买」"}
                    </p>
                </div>
            )}
            <Turnstile
                siteKey={siteKey}
                onSuccess={onSuccess}
                onExpire={onExpire}
                onWidgetLoad={onWidgetReady}
            />
        </div>
    )
}
