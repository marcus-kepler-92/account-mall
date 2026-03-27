"use client"

import { X } from "lucide-react"
import type { Table } from "@tanstack/react-table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTableViewOptions } from "./data-table-view-options"
import type { ReactNode } from "react"

interface StatusOption {
    label: string
    value: string
}

interface ClientDataTableToolbarProps<TData> {
    table: Table<TData>
    searchColumn: string
    searchPlaceholder: string
    statusColumn?: string
    statusOptions?: StatusOption[]
    children?: ReactNode
}

export function ClientDataTableToolbar<TData>({
    table,
    searchColumn,
    searchPlaceholder,
    statusColumn,
    statusOptions,
    children,
}: ClientDataTableToolbarProps<TData>) {
    const searchFilter = (table.getColumn(searchColumn)?.getFilterValue() as string) ?? ""
    const statusFilter = statusColumn
        ? ((table.getColumn(statusColumn)?.getFilterValue() as string) ?? "")
        : ""
    const hasFilters = table.getState().columnFilters.length > 0

    return (
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap flex-1 items-center gap-2">
                <Input
                    placeholder={searchPlaceholder}
                    value={searchFilter}
                    onChange={(e) => table.getColumn(searchColumn)?.setFilterValue(e.target.value)}
                    className="h-8 w-[150px] lg:w-[250px]"
                />
                {statusColumn && statusOptions && (
                    <div className="flex items-center gap-1">
                        {statusOptions.map((opt) => (
                            <Badge
                                key={opt.value}
                                variant={statusFilter === opt.value ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() =>
                                    table.getColumn(statusColumn)?.setFilterValue(opt.value || undefined)
                                }
                            >
                                {opt.label}
                            </Badge>
                        ))}
                    </div>
                )}
                {children}
                {hasFilters && (
                    <Button
                        variant="ghost"
                        onClick={() => table.resetColumnFilters()}
                        className="h-8 px-2 lg:px-3"
                    >
                        重置
                        <X className="ml-2 size-4" />
                    </Button>
                )}
            </div>
            <DataTableViewOptions table={table} />
        </div>
    )
}
