import { parseServerSort } from "@/lib/table-sort"
import { parseDetailPaging } from "./data"

/**
 * Parse the full per-tab query (paging + sort + status + search) shared by the
 * orders and commissions detail tabs. Kept apart from data.ts so the pure
 * helpers there stay free of the table-sort/nuqs dependency (which would
 * otherwise leak into the client detail sheet and the pure unit tests). Each
 * tab keeps its own where-clause construction since those legitimately differ.
 */
export function parseDetailQuery(
    searchParams: {
        page?: string | null
        pageSize?: string | null
        sort?: string | null
        sortDir?: string | null
        status?: string | null
        search?: string | null
    },
    allowedStatuses: readonly string[],
) {
    const { page, pageSize } = parseDetailPaging(searchParams)
    const { orderBy } = parseServerSort(
        searchParams.sort ?? null,
        searchParams.sortDir ?? null,
        ["createdAt", "amount"] as const,
        { sort: "createdAt", sortDir: "desc" },
    )
    const statusList = (searchParams.status ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => allowedStatuses.includes(s))
    const search = (searchParams.search ?? "").trim()
    return { page, pageSize, orderBy, statusList, search }
}
