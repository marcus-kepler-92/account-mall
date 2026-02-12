"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
            <div className="flex flex-col items-center text-center">
                <div className="mb-6 rounded-full bg-destructive/10 p-6">
                    <AlertTriangle className="size-16 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">出错了</h1>
                <p className="mt-2 text-muted-foreground">
                    抱歉，发生了意外错误
                </p>
                <p className="mt-1 text-sm text-muted-foreground max-w-md">
                    {error.message}
                </p>
                <div className="mt-8 flex gap-4">
                    <Button onClick={() => reset()}>重试</Button>
                    <Button variant="outline" asChild>
                        <a href="/">返回首页</a>
                    </Button>
                </div>
            </div>
        </div>
    )
}
