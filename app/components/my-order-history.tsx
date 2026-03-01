"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { getOrderHistory } from "@/lib/order-history-storage"
import { Button } from "@/components/ui/button"
import { Package } from "lucide-react"

/** 我的订单入口：跳转到 /orders/my 详情页（列表 + 订单详情 + 未支付可继续支付） */
export function MyOrderHistory() {
    const [count, setCount] = useState(0)

    useEffect(() => {
        queueMicrotask(() => setCount(getOrderHistory().length))
    }, [])

    if (count === 0) return null

    return (
        <Button
            variant="ghost"
            size="sm"
            className="size-9 shrink-0 gap-1.5 p-0 sm:size-auto sm:px-3 sm:gap-2"
            asChild
        >
            <Link
                href="/orders/my"
                title={`我的订单 (${count})`}
                aria-label={`我的订单，共 ${count} 笔`}
                className="gap-1.5 sm:gap-2"
            >
                <Package className="size-4 shrink-0" aria-hidden />
                <span className="hidden text-muted-foreground sm:inline">我的订单 ({count})</span>
            </Link>
        </Button>
    )
}
