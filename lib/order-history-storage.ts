import * as z from "zod"

/**
 * Client-side only. Local storage key for recent orders (no card content, no password).
 */
export const ORDER_HISTORY_KEY = "account-mall-order-history"

const orderHistoryItemSchema = z.object({
    orderNo: z.string(),
    productName: z.string(),
    amount: z.number(),
    createdAt: z.string(),
    // MANUAL fulfillment introduced AWAITING_FULFILLMENT/PROCESSING. Older entries written before
    // this change predate those values, so legacy items still validate against the original set.
    status: z.enum([
        "PENDING",
        "AWAITING_FULFILLMENT",
        "PROCESSING",
        "COMPLETED",
        "CLOSED",
    ]),
    // MANUAL-only optional fields. Older entries (NORMAL/AUTO_FETCH) saved before MANUAL existed
    // won't have these keys; Zod `.optional().nullable()` accepts both missing and explicit null.
    variantName: z.string().nullable().optional(),
    fulfillment: z
        .object({ content: z.string() })
        .nullable()
        .optional(),
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

/** 快速判断本地是否有任何订单历史，用于客户端预检 */
export function hasLocalOrderHistory(): boolean {
    return getStored().length > 0
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
