import type { AutoFetchCardPayload } from "@/lib/auto-fetch-card"

export type CardItem = { content: string } | (AutoFetchCardPayload & { content: string })

export interface OrderResult {
    orderNo: string
    productName: string
    createdAt: string
    status: "PENDING" | "COMPLETED" | "CLOSED"
    cards: CardItem[]
    isPending?: boolean
    canPay?: boolean
    /** PENDING 订单的支付截止时间 */
    expiresAt?: string
    /** AUTO_FETCH 账号内容有效期 */
    contentExpiresAt?: string
    isAutoFetch?: boolean
    canSwitch?: boolean
    remainingSwitches?: number
    successToken?: string
    cardTemplates?: { template: string }[]
}

export interface OrderListItem {
    orderNo: string
    productName: string
    createdAt: string
    status: "PENDING" | "COMPLETED" | "CLOSED"
    quantity: number
    amount: number
}

export type LookupMode = "orderNo" | "email"
