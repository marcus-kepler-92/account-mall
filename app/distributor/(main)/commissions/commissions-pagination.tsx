"use client"

import { ListPagination } from "@/app/components/list-pagination"

export function DistributorCommissionsPagination({
    page,
    totalPages,
    total,
}: {
    page: number
    totalPages: number
    total: number
}) {
    return (
        <ListPagination
            page={page}
            totalPages={totalPages}
            total={total}
            buildPageUrl={(p) => `/distributor/commissions?page=${p}`}
        />
    )
}
