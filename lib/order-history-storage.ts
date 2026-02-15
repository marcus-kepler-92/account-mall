import { z } from "zod"

/**
 * Client-side only. Local storage key for recent orders (no card content, no password).
 */
export const ORDER_HISTORY_KEY = "account-mall-order-history"

const orderHistoryItemSchema = z.object({
    orderNo: z.string(),
    productName: z.string(),
    amount: z.number(),
    createdAt: z.string(),
    status: z.enum(["PENDING", "COMPLETED", "CLOSED"]),
})

const orderHistoryArraySchema = z.array(orderHistoryItemSchema)

export type OrderHistoryItem = z.infer<typeof orderHistoryItemSchema>

const MAX_ITEMS = 50

function getStored(): OrderHistoryItem[] {
    if (typeof window === "undefined") return []
    try {
        const raw = localStorage.getItem(ORDER_HISTORY_KEY)
        if (!raw) return []
        const parsed = orderHistoryArraySchema.safeParse(JSON.parse(raw))
        if (!parsed.success) return []
        return parsed.data.slice(0, MAX_ITEMS)
    } catch {
        return []
    }
}

export function getOrderHistory(): OrderHistoryItem[] {
    return getStored().slice(0, MAX_ITEMS)
}

export function addOrUpdateOrder(item: OrderHistoryItem): void {
    if (typeof window === "undefined") return
    const list = getStored()
    const idx = list.findIndex((o) => o.orderNo === item.orderNo)
    if (idx >= 0) {
        list[idx] = item
    } else {
        list.unshift(item)
    }
    const trimmed = list.slice(0, MAX_ITEMS)
    try {
        localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(trimmed))
    } catch {
        // ignore quota or disabled storage
    }
}

/** Update only status for an existing order in history. */
export function updateOrderStatusInHistory(
    orderNo: string,
    status: OrderHistoryItem["status"],
): void {
    if (typeof window === "undefined") return
    const list = getStored()
    const idx = list.findIndex((o) => o.orderNo === orderNo)
    if (idx < 0) return
    list[idx] = { ...list[idx], status }
    try {
        localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(list))
    } catch {
        // ignore
    }
}

/** Remove one order from local history (e.g. user clears it). */
export function removeOrderFromHistory(orderNo: string): void {
    if (typeof window === "undefined") return
    const list = getStored().filter((o) => o.orderNo !== orderNo)
    try {
        localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(list))
    } catch {
        // ignore
    }
}
