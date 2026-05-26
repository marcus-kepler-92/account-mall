import { OrderStatus } from "@prisma/client"

/**
 * MANUAL fulfillment center supports a 4-state status filter — same enum
 * values as the global Orders center to keep filter URLs / KPI links
 * portable. PENDING is excluded by definition (this center only deals
 * with paid MANUAL orders).
 */
const FULFILLMENT_STATUS_VALUES = [
    OrderStatus.AWAITING_FULFILLMENT,
    OrderStatus.PROCESSING,
    OrderStatus.COMPLETED,
    OrderStatus.CLOSED,
] as const

export type FulfillmentStatusFilter = (typeof FULFILLMENT_STATUS_VALUES)[number]

export type FulfillmentFiltersInput = {
    page?: string | null
    pageSize?: string | null
    status?: string | null
    dunnedOnly?: string | null
}

export type FulfillmentFiltersState = {
    page: number
    pageSize: number
    /** Active status: empty → no status filter (all 4). */
    status: FulfillmentStatusFilter | ""
    statusList: FulfillmentStatusFilter[]
    dunnedOnly: boolean
}

export const DEFAULT_FULFILLMENT_FILTERS: FulfillmentFiltersState = {
    page: 1,
    pageSize: 20,
    status: "",
    statusList: [],
    dunnedOnly: false,
}

export function parseFulfillmentFilters(
    input: FulfillmentFiltersInput,
): FulfillmentFiltersState {
    const page = Math.max(
        1,
        parseInt(input.page ?? "", 10) || DEFAULT_FULFILLMENT_FILTERS.page,
    )
    const rawPageSize =
        parseInt(input.pageSize ?? "", 10) || DEFAULT_FULFILLMENT_FILTERS.pageSize
    const pageSize = Math.min(100, Math.max(1, rawPageSize))

    const statusRaw = (input.status ?? "").trim()
    const status: FulfillmentFiltersState["status"] =
        (FULFILLMENT_STATUS_VALUES as readonly string[]).includes(statusRaw)
            ? (statusRaw as FulfillmentStatusFilter)
            : ""

    const dunnedOnly =
        (input.dunnedOnly ?? "").trim().toLowerCase() === "true"

    return {
        page,
        pageSize,
        status,
        statusList: status ? [status] : [],
        dunnedOnly,
    }
}
