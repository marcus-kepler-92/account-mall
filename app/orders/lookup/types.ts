import type { AutoFetchCardPayload } from "@/lib/auto-fetch-card"

export type CardItem = { content: string } | (AutoFetchCardPayload & { content: string })

export type OrderResultStatus =
    | "PENDING"
    | "AWAITING_FULFILLMENT"
    | "PROCESSING"
    | "COMPLETED"
    | "CLOSED"

export type OrderProductType = "NORMAL" | "AUTO_FETCH" | "MANUAL"

export interface OrderResult {
    orderNo: string
    productName: string
    createdAt: string
    status: OrderResultStatus
    cards: CardItem[]
    /** Order primary id — MANUAL intermediate states only (powers the dun button URL). */
    id?: string
    /** Buyer email — MANUAL intermediate states only (powers the dun-button auth body). */
    email?: string
    /** Product type — present on COMPLETED/CLOSED and MANUAL intermediate states. */
    productType?: OrderProductType
    /** MANUAL fulfillment content (admin-delivered text). null for NORMAL/AUTO_FETCH. */
    fulfillment?: { content: string } | null
    /** MANUAL variant snapshot, e.g. "10K 钻石". null/undefined for NORMAL/AUTO_FETCH. */
    variantName?: string | null
    /** MANUAL buyer-triggered "催发货" count. */
    dunCount?: number
    /** MANUAL last "催发货" timestamp (ISO). */
    lastDunAt?: string | null
    /** MANUAL server-rendered ETA hint, e.g. "卖家通常在 15 分钟内发货". */
    etaText?: string
    /** MANUAL: SiteSettings.dunMinAgeMinutes in seconds. */
    dunMinAgeSeconds?: number
    /** MANUAL: seconds elapsed since order was created (used to seed the dun-button countdown). */
    orderAgeSeconds?: number
    /** MANUAL: initial dun-button cooldown remaining in seconds. */
    initialCooldownSeconds?: number
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
    status: OrderResultStatus
    quantity: number
    amount: number
}

export type LookupMode = "orderNo" | "email"
