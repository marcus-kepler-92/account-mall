"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
    useReactTable,
    getCoreRowModel,
    type VisibilityState,
} from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    DataTable,
    DataTablePagination,
    DataTableToolbar,
} from "@/app/admin/components"
import { fulfillmentColumns, type FulfillmentRow } from "./fulfillment-columns"

interface Props {
    data: FulfillmentRow[]
    total: number
}

const statusOptions = [
    { label: "待接单", value: "AWAITING_FULFILLMENT" },
    { label: "处理中", value: "PROCESSING" },
    { label: "已完成", value: "COMPLETED" },
    { label: "已关闭", value: "CLOSED" },
]

export function FulfillmentDataTable({ data, total }: Props) {
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    const table = useReactTable({
        data,
        columns: fulfillmentColumns,
        state: { columnVisibility },
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
        manualPagination: true,
        manualFiltering: true,
    })

    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="text-base">待处理订单</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
                <DataTableToolbar
                    table={table}
                    searchPlaceholder="搜索邮箱或订单号..."
                    searchParamKey="search"
                    statusOptions={statusOptions}
                    statusParamKey="status"
                >
                    <DunnedOnlyBadge />
                </DataTableToolbar>
                <DataTable
                    table={table}
                    columns={fulfillmentColumns}
                    emptyMessage="暂无订单"
                />
                <DataTablePagination table={table} total={total} />
            </CardContent>
        </Card>
    )
}

/**
 * Sibling facet to the status badges — toggles `?dunnedOnly=true`. Lives
 * in the toolbar's children slot so it sits inline with the status row
 * and shares the toolbar's "重置" affordance via the URL.
 */
function DunnedOnlyBadge() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [, startTransition] = useTransition()

    const active = (searchParams.get("dunnedOnly") ?? "").toLowerCase() === "true"

    const toggle = () => {
        const params = new URLSearchParams(searchParams.toString())
        if (active) {
            params.delete("dunnedOnly")
        } else {
            params.set("dunnedOnly", "true")
        }
        params.set("page", "1")
        startTransition(() => {
            router.push(`?${params.toString()}`)
        })
    }

    return (
        <Badge
            variant={active ? "destructive" : "outline"}
            className="cursor-pointer"
            onClick={toggle}
        >
            仅看被催
        </Badge>
    )
}
