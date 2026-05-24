import { OrderStatus } from "@prisma/client"

export const STATUS_VALUES = [
    "in_progress",
    "awaiting",
    "processing",
    "completed",
    "closed",
    "all",
] as const

export type FulfillmentStatusFilter = (typeof STATUS_VALUES)[number]

export type FulfillmentFiltersInput = {
    status?: string | null
    dunnedOnly?: string | null
}

export type FulfillmentFiltersState = {
    status: FulfillmentStatusFilter
    dunnedOnly: boolean
    statusList: OrderStatus[]
}

export const DEFAULT_FULFILLMENT_FILTERS: FulfillmentFiltersState = {
    status: "in_progress",
    dunnedOnly: false,
    statusList: [OrderStatus.AWAITING_FULFILLMENT, OrderStatus.PROCESSING],
}

function statusToList(status: FulfillmentStatusFilter): OrderStatus[] {
    switch (status) {
        case "awaiting":
            return [OrderStatus.AWAITING_FULFILLMENT]
        case "processing":
            return [OrderStatus.PROCESSING]
        case "completed":
            return [OrderStatus.COMPLETED]
        case "closed":
            return [OrderStatus.CLOSED]
        case "all":
            return []
        case "in_progress":
        default:
            return [OrderStatus.AWAITING_FULFILLMENT, OrderStatus.PROCESSING]
    }
}

export function parseFulfillmentFilters(input: FulfillmentFiltersInput): FulfillmentFiltersState {
    const raw = (input.status ?? "").trim().toLowerCase()
    const status: FulfillmentStatusFilter =
        (STATUS_VALUES as readonly string[]).includes(raw)
            ? (raw as FulfillmentStatusFilter)
            : "in_progress"
    const dunnedOnly = (input.dunnedOnly ?? "").trim().toLowerCase() === "true"
    return {
        status,
        dunnedOnly,
        statusList: statusToList(status),
    }
}
