"use client"

import { useEffect } from "react"
import { trackEvent } from "@/lib/analytics"

type Props = {
  orderId: string
  orderNo: string
  productName: string
  amount: number
  isFree: boolean
}

export function OrderCompletedTracker({
  orderId,
  orderNo,
  productName,
  amount,
  isFree,
}: Props) {
  useEffect(() => {
    // Deduplicate per session: success page can be revisited or refreshed
    const key = `tracked:order_completed:${orderNo}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, "1")
    trackEvent("order_completed", { orderId, productName, amount, isFree })
  }, [orderId, orderNo, productName, amount, isFree])

  return null
}
