"use client"

import { useEffect } from "react"
import { updateOrderStatusInHistory } from "@/lib/order-history-storage"

type Props = {
    orderNo: string
}

/** On mount, mark this order as COMPLETED in local order history. */
export function OrderSuccessSyncHistory({ orderNo }: Props) {
    useEffect(() => {
        updateOrderStatusInHistory(orderNo, "COMPLETED")
    }, [orderNo])
    return null
}
