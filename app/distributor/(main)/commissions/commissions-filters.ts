const COMMISSION_STATUS_VALUES = ["PENDING", "SETTLED", "WITHDRAWN"] as const
export type CommissionStatusFilter = (typeof COMMISSION_STATUS_VALUES)[number]

export type DistributorCommissionFiltersState = {
    page: number
    pageSize: number
    statusList: CommissionStatusFilter[]
    search: string
}

export type DistributorCommissionFiltersInput = {
    page?: string | null
    pageSize?: string | null
    status?: string | null
    search?: string | null
}

export const DEFAULT_DISTRIBUTOR_COMMISSION_FILTERS = {
    page: 1,
    pageSize: 20,
    statusList: [] as CommissionStatusFilter[],
}

export function parseDistributorCommissionFilters(
    input: DistributorCommissionFiltersInput
): DistributorCommissionFiltersState {
    const page = Math.max(1, parseInt(input.page ?? "", 10) || 1)
    const rawPageSize = parseInt(input.pageSize ?? "", 10) || 20
    const pageSize = Math.min(100, Math.max(1, rawPageSize))

    const statusRaw = (input.status ?? "").trim()
    const statusList = statusRaw
        ? statusRaw
              .split(",")
              .map((s) => s.trim())
              .filter((s): s is CommissionStatusFilter =>
                  COMMISSION_STATUS_VALUES.includes(s as CommissionStatusFilter)
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
