const WITHDRAWAL_STATUS_VALUES = ["PENDING", "PAID", "REJECTED"] as const
export type WithdrawalStatusFilter = (typeof WITHDRAWAL_STATUS_VALUES)[number]

export type WithdrawalFiltersState = {
    page: number
    pageSize: number
    status: "ALL" | WithdrawalStatusFilter
    statusList: WithdrawalStatusFilter[]
    search: string
}

export type WithdrawalFiltersInput = {
    page?: string | null
    pageSize?: string | null
    status?: string | null
    search?: string | null
}

export const DEFAULT_WITHDRAWAL_FILTERS: WithdrawalFiltersState = {
    page: 1,
    pageSize: 20,
    status: "ALL",
    statusList: [],
    search: "",
}

export function parseWithdrawalFilters(input: WithdrawalFiltersInput): WithdrawalFiltersState {
    const page = Math.max(1, parseInt(input.page ?? "", 10) || DEFAULT_WITHDRAWAL_FILTERS.page)
    const rawPageSize = parseInt(input.pageSize ?? "", 10) || DEFAULT_WITHDRAWAL_FILTERS.pageSize
    const pageSize = Math.min(100, Math.max(1, rawPageSize))

    const statusRaw = (input.status ?? "").trim()
    const statusList = statusRaw
        ? statusRaw
              .split(",")
              .map((s) => s.trim())
              .filter((s): s is WithdrawalStatusFilter =>
                  WITHDRAWAL_STATUS_VALUES.includes(s as WithdrawalStatusFilter)
              )
        : []
    const status: WithdrawalFiltersState["status"] =
        statusList.length === 1 ? statusList[0] : "ALL"

    return {
        page,
        pageSize,
        status,
        statusList,
        search: (input.search ?? "").trim(),
    }
}

export function buildWithdrawalFiltersQuery(filters: WithdrawalFiltersState): string {
    const params = new URLSearchParams()
    if (filters.page > 1) params.set("page", String(filters.page))
    if (filters.pageSize !== DEFAULT_WITHDRAWAL_FILTERS.pageSize) params.set("pageSize", String(filters.pageSize))
    if (filters.statusList.length > 0) params.set("status", filters.statusList.join(","))
    if (filters.search) params.set("search", filters.search)
    const query = params.toString()
    return query ? `?${query}` : ""
}
