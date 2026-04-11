"use client"

import dynamic from "next/dynamic"
import type { ProductRow } from "./products-columns"
import type { ReactNode } from "react"

const ProductsDataTable = dynamic(
    () => import("./products-data-table").then((m) => ({ default: m.ProductsDataTable })),
    { ssr: false }
)

export function ProductsTableWrapper({
    data,
    actions,
}: {
    data: ProductRow[]
    actions?: ReactNode
}) {
    return <ProductsDataTable data={data} actions={actions} />
}
