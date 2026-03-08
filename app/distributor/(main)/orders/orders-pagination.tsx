"use client"

import { ListPagination } from "@/app/components/list-pagination"

export function DistributorOrdersPagination({
    page,
    totalPages,
    total,
    currentStatus,
}: {
    page: number
    totalPages: number
    total: number
    currentStatus?: string
}) {
    const buildPageUrl = (p: number) => {
        const params = new URLSearchParams()
        params.set("page", String(p))
        if (currentStatus) params.set("status", currentStatus)
        return `/distributor/orders?${params.toString()}`
    }
    return (
        <ListPagination
            page={page}
            totalPages={totalPages}
            total={total}
            buildPageUrl={buildPageUrl}
        />
    )
}
