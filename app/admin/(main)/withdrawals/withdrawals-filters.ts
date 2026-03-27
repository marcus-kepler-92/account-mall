const WITHDRAWAL_STATUS_VALUES = ["PENDING", "PAID", "REJECTED"] as const
export type WithdrawalStatusFilter = (typeof WITHDRAWAL_STATUS_VALUES)[number]

export type WithdrawalFiltersState = {
    page: number
    pageSize: number
    status: "ALL" | WithdrawalStatusFilter
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
    search: "",
}

export function parseWithdrawalFilters(input: WithdrawalFiltersInput): WithdrawalFiltersState {
    const page = Math.max(1, parseInt(input.page ?? "", 10) || DEFAULT_WITHDRAWAL_FILTERS.page)
    const rawPageSize = parseInt(input.pageSize ?? "", 10) || DEFAULT_WITHDRAWAL_FILTERS.pageSize
    const pageSize = Math.min(100, Math.max(1, rawPageSize))

    const statusRaw = (input.status ?? "").trim()
    const status = WITHDRAWAL_STATUS_VALUES.includes(statusRaw as WithdrawalStatusFilter)
        ? (statusRaw as WithdrawalStatusFilter)
        : "ALL"

    return {
        page,
        pageSize,
        status,
        search: (input.search ?? "").trim(),
    }
}
