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
            className="h-9 shrink-0 px-2 sm:px-3 touch-manipulation"
            asChild
        >
            <Link
                href="/orders/my"
                title={`我的订单 (${count})`}
                aria-label={`我的订单，共 ${count} 笔`}
                className="gap-1.5"
            >
                <Package className="hidden sm:block size-4 shrink-0" aria-hidden />
                <span className="text-xs sm:hidden">订单({count})</span>
                <span className="hidden sm:inline text-muted-foreground">我的订单 ({count})</span>
            </Link>
        </Button>
    )
}
