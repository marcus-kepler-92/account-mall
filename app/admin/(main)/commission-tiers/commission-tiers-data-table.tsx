"use client"

import { useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    type SortingState,
    type VisibilityState,
} from "@tanstack/react-table"
import { DataTable } from "@/app/admin/components"
import { commissionTiersColumns, type TierRow } from "./commission-tiers-columns"

export function CommissionTiersDataTable({ data }: { data: TierRow[] }) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    const table = useReactTable({
        data,
        columns: commissionTiersColumns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onSortingChange: setSorting,
        onColumnVisibilityChange: setColumnVisibility,
        state: { sorting, columnVisibility },
    })

    return (
        <DataTable
            table={table}
            columns={commissionTiersColumns}
            emptyMessage="暂无阶梯档位，点击右上角「添加档位」创建。"
        />
    )
}
