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
}: {
    data: ProductRow[]
    isSuperAdmin?: boolean
}) {
    return <ProductsDataTable data={data} isSuperAdmin={isSuperAdmin} />
}
