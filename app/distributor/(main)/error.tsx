"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function DistributorError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error("[distributor]", error)
    }, [error])

    return (
        <div className="flex flex-col items-center justify-center px-4 py-24">
            <div className="mb-6 rounded-full bg-destructive/10 p-5">
                <AlertTriangle className="size-10 text-destructive" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">页面加载出错</h2>
            <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
                {error.message || "发生了意外错误，请稍后再试"}
            </p>
            <Button className="mt-6" onClick={() => reset()}>
                重试
            </Button>
        </div>
    )
}
