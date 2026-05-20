export type ConvFiltersState = {
    q: string
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
    return {
        q: (params.q ?? "").trim(),
        from: parseDate(params.from),
        to: parseDate(params.to),
        escalated: params.escalated === "true" ? true : undefined,
        page,
        pageSize,
    }
}
