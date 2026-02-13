export type OrderFiltersState = {
    page: number
    pageSize: number
    status: "ALL" | "PENDING" | "COMPLETED" | "CLOSED"
    email: string
    orderNo: string
    dateFrom: string
    dateTo: string
}

export type OrderFiltersInput = {
    page?: string | null
    pageSize?: string | null
    status?: string | null
    email?: string | null
    orderNo?: string | null
    dateFrom?: string | null
    dateTo?: string | null
}

export const DEFAULT_ORDER_FILTERS: OrderFiltersState = {
    page: 1,
    pageSize: 20,
    status: "ALL",
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

    const statusRaw = input.status ?? DEFAULT_ORDER_FILTERS.status
    const status: OrderFiltersState["status"] =
        statusRaw === "PENDING" || statusRaw === "COMPLETED" || statusRaw === "CLOSED"
            ? statusRaw
            : "ALL"

    return {
        page,
        pageSize,
        status,
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

    if (filters.status !== "ALL") {
        params.set("status", filters.status)
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

