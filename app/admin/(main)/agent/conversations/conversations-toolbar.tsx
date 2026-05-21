"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface ConversationsToolbarProps {
    initialQuery: string
    initialOrderNo: string
    escalatedOnly: boolean
}

export function ConversationsToolbar({
    initialQuery,
    initialOrderNo,
    escalatedOnly,
}: ConversationsToolbarProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [, startTransition] = useTransition()
    const [query, setQuery] = useState(initialQuery)
    const [orderNo, setOrderNo] = useState(initialOrderNo)

    useEffect(() => {
        setQuery(initialQuery)
    }, [initialQuery])
    useEffect(() => {
        setOrderNo(initialOrderNo)
    }, [initialOrderNo])

    const update = (next: URLSearchParams) => {
        next.delete("page")
        startTransition(() => {
            const s = next.toString()
            router.push(s ? `?${s}` : "?")
        })
    }

    const commitQuery = (value: string) => {
        const next = new URLSearchParams(searchParams.toString())
        if (value) next.set("q", value)
        else next.delete("q")
        update(next)
    }

    const commitOrderNo = (value: string) => {
        const next = new URLSearchParams(searchParams.toString())
        const trimmed = value.trim()
        if (trimmed) next.set("orderNo", trimmed)
        else next.delete("orderNo")
        update(next)
    }

    const toggleEscalated = () => {
        const next = new URLSearchParams(searchParams.toString())
        if (escalatedOnly) next.delete("escalated")
        else next.set("escalated", "true")
        update(next)
    }

    const clearAll = () => {
        setQuery("")
        setOrderNo("")
        startTransition(() => router.push("?"))
    }

    const hasFilters = searchParams.toString().length > 0

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Input
                placeholder="搜索消息内容…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") commitQuery(query)
                }}
                onBlur={() => {
                    if (query !== initialQuery) commitQuery(query)
                }}
                className="h-8 w-[200px] lg:w-[300px]"
            />
            <Input
                placeholder="按订单号搜（精确）"
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") commitOrderNo(orderNo)
                }}
                onBlur={() => {
                    if (orderNo !== initialOrderNo) commitOrderNo(orderNo)
                }}
                className="h-8 w-[200px]"
            />
            <Badge
                variant={escalatedOnly ? "default" : "outline"}
                className="cursor-pointer"
                onClick={toggleEscalated}
            >
                仅升级会话
            </Badge>
            {hasFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAll}
                    className="h-8 px-2"
                >
                    重置
                    <X className="size-4" />
                </Button>
            )}
        </div>
    )
}
