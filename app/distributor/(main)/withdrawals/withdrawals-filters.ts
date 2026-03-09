const WITHDRAWAL_STATUS_VALUES = ["PENDING", "PAID", "REJECTED"] as const
export type WithdrawalStatusFilter = (typeof WITHDRAWAL_STATUS_VALUES)[number]

export type DistributorWithdrawalFiltersState = {
    page: number
    pageSize: number
    statusList: WithdrawalStatusFilter[]
}

export type DistributorWithdrawalFiltersInput = {
    page?: string | null
    pageSize?: string | null
    status?: string | null
}

export const DEFAULT_DISTRIBUTOR_WITHDRAWAL_FILTERS = {
    page: 1,
    pageSize: 20,
    statusList: [] as WithdrawalStatusFilter[],
}

export function parseDistributorWithdrawalFilters(
    input: DistributorWithdrawalFiltersInput
): DistributorWithdrawalFiltersState {
    const page = Math.max(1, parseInt(input.page ?? "", 10) || 1)
    const rawPageSize = parseInt(input.pageSize ?? "", 10) || 20
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

    return {
        page,
        pageSize,
        statusList,
    }
}
