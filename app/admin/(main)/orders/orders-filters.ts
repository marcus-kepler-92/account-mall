const ORDER_STATUS_VALUES = ["PENDING", "COMPLETED", "CLOSED"] as const
export type OrderStatusFilter = (typeof ORDER_STATUS_VALUES)[number]

export type OrderFiltersState = {
    page: number
    pageSize: number
    /** Comma-separated in URL; parsed to statusList */
    status: "ALL" | "PENDING" | "COMPLETED" | "CLOSED"
    statusList: OrderStatusFilter[]
    search: string
    email: string
    orderNo: string
    dateFrom: string
    dateTo: string
}

export type OrderFiltersInput = {
    page?: string | null
    pageSize?: string | null
    status?: string | null
    search?: string | null
    email?: string | null
    orderNo?: string | null
    dateFrom?: string | null
    dateTo?: string | null
}

export const DEFAULT_ORDER_FILTERS: OrderFiltersState = {
    page: 1,
    pageSize: 20,
    status: "ALL",
    statusList: [],
    search: "",
    email: "",
    orderNo: "",
    dateFrom: "",
    dateTo: "",
}

export function parseOrderFilters(input: OrderFiltersInput): OrderFiltersState {
    const page = Math.max(1, parseInt(input.page ?? "", 10) || DEFAULT_ORDER_FILTERS.page)
    const rawPageSize =
        parseInt(input.pageSize ?? "", 10) || DEFAULT_ORDER_FILTERS.pageSize
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
    const status: OrderFiltersState["status"] =
        statusList.length === 1
            ? statusList[0]
            : statusList.length > 1
              ? "ALL"
              : "ALL"

    const search = (input.search ?? "").trim()
    return {
        page,
        pageSize,
        status,
        statusList,
        search,
        email: (input.email ?? "").trim(),
        orderNo: (input.orderNo ?? "").trim(),
        dateFrom: (input.dateFrom ?? "").trim(),
        dateTo: (input.dateTo ?? "").trim(),
    }
}

export function buildOrderFiltersQuery(filters: OrderFiltersState): string {
    const params = new URLSearchParams()

    if (filters.page > 1) {
        params.set("page", String(filters.page))
    }

    if (filters.pageSize !== DEFAULT_ORDER_FILTERS.pageSize) {
        params.set("pageSize", String(filters.pageSize))
    }

    if (filters.statusList.length > 0) {
        params.set("status", filters.statusList.join(","))
    }

    if (filters.search) {
        params.set("search", filters.search)
    }

    if (filters.email) {
        params.set("email", filters.email)
    }

    if (filters.orderNo) {
        params.set("orderNo", filters.orderNo)
    }

    if (filters.dateFrom) {
        params.set("dateFrom", filters.dateFrom)
    }

    if (filters.dateTo) {
        params.set("dateTo", filters.dateTo)
    }

    const query = params.toString()
    return query ? `?${query}` : ""
}

