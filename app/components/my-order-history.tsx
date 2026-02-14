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
        setCount(getOrderHistory().length)
    }, [])

    if (count === 0) return null

    return (
        <Button variant="ghost" size="sm" className="gap-2" asChild>
            <Link href="/orders/my">
                <Package className="size-4" />
                我的订单
                <span className="text-muted-foreground">({count})</span>
            </Link>
        </Button>
    )
}
