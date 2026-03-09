const ORDER_STATUS_VALUES = ["PENDING", "COMPLETED", "CLOSED"] as const
export type OrderStatusFilter = (typeof ORDER_STATUS_VALUES)[number]

export type DistributorOrderFiltersState = {
    page: number
    pageSize: number
    statusList: OrderStatusFilter[]
    search: string
}

export type DistributorOrderFiltersInput = {
    page?: string | null
    pageSize?: string | null
    status?: string | null
    search?: string | null
}

export const DEFAULT_DISTRIBUTOR_ORDER_FILTERS = {
    page: 1,
    pageSize: 20,
    statusList: [] as OrderStatusFilter[],
    search: "",
}

export function parseDistributorOrderFilters(
    input: DistributorOrderFiltersInput
): DistributorOrderFiltersState {
    const page = Math.max(1, parseInt(input.page ?? "", 10) || DEFAULT_DISTRIBUTOR_ORDER_FILTERS.page)
    const rawPageSize = parseInt(input.pageSize ?? "", 10) || 20
    const pageSize = Math.min(100, Math.max(1, rawPageSize))

    const statusRaw = (input.status ?? "").trim()
    const statusList = statusRaw
        ? statusRaw
              .split(",")
              .map((s) => s.trim())
              .filter((s): s is OrderStatusFilter =>
                  ORDER_STATUS_VALUES.includes(s as OrderStatusFilter)
              )
        : []

    const search = (input.search ?? "").trim()

    return {
        page,
        pageSize,
        statusList,
        search,
    }
}
