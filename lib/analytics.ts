"use client"

import { track } from "@vercel/analytics"

type Events = {
  payment_initiated: {
    productName: string
    amount: number
    paymentMethod: string
  }
  order_completed: {
    orderId: string
    productName: string
    amount: number
    isFree: boolean
  }
}

export function trackEvent<K extends keyof Events>(
  event: K,
  properties: Events[K],
): void {
  track(event, properties)
}
