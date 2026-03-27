"use client"

import type { Table } from "@tanstack/react-table"
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface ClientDataTablePaginationProps<TData> {
    table: Table<TData>
    pageSizeOptions?: number[]
}

export function ClientDataTablePagination<TData>({
    table,
    pageSizeOptions = [10, 20, 30, 50, 100],
}: ClientDataTablePaginationProps<TData>) {
    const { pageIndex, pageSize } = table.getState().pagination
    const page = pageIndex + 1
    const pageCount = table.getPageCount()
    const total = table.getFilteredRowModel().rows.length

    return (
        <div className="flex flex-col gap-3 px-2 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0 shrink-0 text-sm text-muted-foreground">
                <span>共 {total} 条记录</span>
            </div>
            <div className="flex min-h-10 flex-wrap items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                    <p className="shrink-0 text-sm font-medium">每页</p>
                    <Select
                        value={`${pageSize}`}
                        onValueChange={(value) => {
                            table.setPageSize(Number(value))
                            table.setPageIndex(0)
                        }}
                    >
                        <SelectTrigger className="h-9 min-h-9 w-[70px] touch-manipulation sm:h-8">
                            <SelectValue placeholder={pageSize} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {pageSizeOptions.map((size) => (
                                <SelectItem key={size} value={`${size}`}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex min-h-9 shrink-0 items-center text-sm font-medium sm:w-[100px] sm:justify-center">
                    第 {page} / {pageCount} 页
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="icon"
                        className="hidden h-9 min-h-9 w-9 shrink-0 touch-manipulation lg:flex lg:h-8 lg:w-8"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <span className="sr-only">首页</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-9 min-h-9 w-9 shrink-0 touch-manipulation lg:h-8 lg:w-8"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <span className="sr-only">上一页</span>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-9 min-h-9 w-9 shrink-0 touch-manipulation lg:h-8 lg:w-8"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <span className="sr-only">下一页</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="hidden h-9 min-h-9 w-9 shrink-0 touch-manipulation lg:flex lg:h-8 lg:w-8"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                    >
                        <span className="sr-only">末页</span>
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
