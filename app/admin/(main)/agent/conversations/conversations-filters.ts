export type ConvFiltersState = {
    q: string
    orderNo: string
    from: Date | undefined
    to: Date | undefined
    escalated: boolean | undefined
    page: number
    pageSize: number
}

function parseDate(s: string | undefined): Date | undefined {
    if (!s) return undefined
    const d = new Date(s)
    return isNaN(d.getTime()) ? undefined : d
}

export function parseConvFilters(
    params: Record<string, string | undefined>,
): ConvFiltersState {
    const page = Math.max(1, Number(params.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20))
    // Order numbers in this codebase are 6–40 chars (see lookupOrder
    // input schema). Filter out anything outside that range so a stray
    // search-term in the wrong box doesn't run a wide ILIKE scan.
    const rawOrder = (params.orderNo ?? "").trim()
    const orderNo = rawOrder.length >= 6 && rawOrder.length <= 40 ? rawOrder : ""
    return {
        q: (params.q ?? "").trim(),
        orderNo,
        from: parseDate(params.from),
        to: parseDate(params.to),
        escalated: params.escalated === "true" ? true : undefined,
        page,
        pageSize,
    }
}
