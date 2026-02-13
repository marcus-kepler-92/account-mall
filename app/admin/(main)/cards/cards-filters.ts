export type CardFiltersState = {
    page: number
    pageSize: number
    status: "ALL" | "UNSOLD" | "RESERVED" | "SOLD"
    productKeyword: string
    orderNo: string
    codeLike: string
}

export type CardFiltersInput = {
    page?: string | null
    pageSize?: string | null
    status?: string | null
    productKeyword?: string | null
    orderNo?: string | null
    codeLike?: string | null
}

export const DEFAULT_CARD_FILTERS: CardFiltersState = {
    page: 1,
    pageSize: 20,
    status: "ALL",
    productKeyword: "",
    orderNo: "",
    codeLike: "",
}

export function parseCardFilters(input: CardFiltersInput): CardFiltersState {
    const page = Math.max(1, parseInt(input.page ?? "", 10) || DEFAULT_CARD_FILTERS.page)
    const rawPageSize =
        parseInt(input.pageSize ?? "", 10) || DEFAULT_CARD_FILTERS.pageSize
    const pageSize = Math.min(100, Math.max(1, rawPageSize))

    const statusRaw = input.status ?? DEFAULT_CARD_FILTERS.status
    const status: CardFiltersState["status"] =
        statusRaw === "UNSOLD" || statusRaw === "RESERVED" || statusRaw === "SOLD"
            ? statusRaw
            : "ALL"

    return {
        page,
        pageSize,
        status,
        productKeyword: (input.productKeyword ?? "").trim(),
        orderNo: (input.orderNo ?? "").trim(),
        codeLike: (input.codeLike ?? "").trim(),
    }
}

export function buildCardFiltersQuery(filters: CardFiltersState): string {
    const params = new URLSearchParams()

    if (filters.page > 1) {
        params.set("page", String(filters.page))
    }

    if (filters.pageSize !== DEFAULT_CARD_FILTERS.pageSize) {
        params.set("pageSize", String(filters.pageSize))
    }

    if (filters.status !== "ALL") {
        params.set("status", filters.status)
    }

    if (filters.productKeyword) {
        params.set("productKeyword", filters.productKeyword)
    }

    if (filters.orderNo) {
        params.set("orderNo", filters.orderNo)
    }

    if (filters.codeLike) {
        params.set("codeLike", filters.codeLike)
    }

    const query = params.toString()
    return query ? `?${query}` : ""
}

