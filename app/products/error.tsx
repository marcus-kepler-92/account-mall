"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function ProductsError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error("[products]", error)
    }, [error])

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
            <div className="mb-6 rounded-full bg-destructive/10 p-5">
                <AlertTriangle className="size-10 text-destructive" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">商品页面出错</h2>
            <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
                {error.message || "无法加载商品信息，请稍后再试"}
            </p>
            <div className="mt-6 flex gap-3">
                <Button onClick={() => reset()}>重试</Button>
                <Button variant="outline" asChild>
                    <Link href="/">返回首页</Link>
                </Button>
            </div>
        </div>
    )
}
