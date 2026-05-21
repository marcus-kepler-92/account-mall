"use client"

import dynamic from "next/dynamic"
import type { ProductRow } from "./products-columns"

const ProductsDataTable = dynamic(
    () => import("./products-data-table").then((m) => ({ default: m.ProductsDataTable })),
    { ssr: false }
)

export function ProductsTableWrapper({
    data,
    isSuperAdmin = false,
    defaultFilters,
}: {
    data: ProductRow[]
    isSuperAdmin?: boolean
    defaultFilters?: { hasAlert?: boolean }
}) {
    return <ProductsDataTable data={data} isSuperAdmin={isSuperAdmin} defaultFilters={defaultFilters} />
}
