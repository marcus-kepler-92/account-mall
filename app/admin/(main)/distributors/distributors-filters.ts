export type DistributorStatusValue = "enabled" | "disabled"

export type DistributorFiltersState = {
    page: number
    pageSize: number
    search: string
    statusList: DistributorStatusValue[]
}

export type DistributorFiltersInput = {
    page?: string | null
    pageSize?: string | null
    search?: string | null
    status?: string | null
}

export const DEFAULT_DISTRIBUTOR_FILTERS: DistributorFiltersState = {
    page: 1,
    pageSize: 20,
    search: "",
    statusList: [],
}

export function parseDistributorFilters(input: DistributorFiltersInput): DistributorFiltersState {
    const page = Math.max(1, parseInt(input.page ?? "", 10) || DEFAULT_DISTRIBUTOR_FILTERS.page)
    const rawPageSize =
        parseInt(input.pageSize ?? "", 10) || DEFAULT_DISTRIBUTOR_FILTERS.pageSize
    const pageSize = Math.min(100, Math.max(1, rawPageSize))

    const statusRaw = (input.status ?? "").trim()
    const statusList = statusRaw
        ? (statusRaw.split(",").map((s) => s.trim()).filter((s): s is DistributorStatusValue => s === "enabled" || s === "disabled"))
        : []

    return {
        page,
        pageSize,
        search: (input.search ?? "").trim(),
        statusList,
    }
}

export function buildDistributorFiltersQuery(filters: DistributorFiltersState): string {
    const params = new URLSearchParams()
    if (filters.page > 1) params.set("page", String(filters.page))
    if (filters.pageSize !== DEFAULT_DISTRIBUTOR_FILTERS.pageSize) params.set("pageSize", String(filters.pageSize))
    if (filters.search) params.set("search", filters.search)
    if (filters.statusList.length > 0) params.set("status", filters.statusList.join(","))
    const query = params.toString()
    return query ? `?${query}` : ""
}
