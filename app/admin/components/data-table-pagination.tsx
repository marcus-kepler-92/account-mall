"use client";

import { Table } from "@tanstack/react-table";
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface DataTablePaginationProps<TData> {
    table: Table<TData>;
    total: number;
    pageSizeOptions?: number[];
}

export function DataTablePagination<TData>({
    table,
    total,
    pageSizeOptions = [10, 20, 30, 50, 100],
}: DataTablePaginationProps<TData>) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "", 10) || 20));
    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    const updateUrl = (newPage: number, newPageSize?: number) => {
        const params = new URLSearchParams(searchParams.toString());
        
        if (newPage > 1) {
            params.set("page", String(newPage));
        } else {
            params.delete("page");
        }
        
        if (newPageSize !== undefined && newPageSize !== 20) {
            params.set("pageSize", String(newPageSize));
        } else if (newPageSize === 20) {
            params.delete("pageSize");
        }
        
        const query = params.toString();
        router.push(query ? `?${query}` : "?");
    };

    const selectedCount = table.getFilteredSelectedRowModel().rows.length;

    return (
        <div className="flex flex-col gap-3 px-2 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0 shrink-0 text-sm text-muted-foreground">
                {selectedCount > 0 ? (
                    <span>已选择 {selectedCount} / {total} 行</span>
                ) : (
                    <span>共 {total} 条记录</span>
                )}
            </div>
            <div className="flex min-h-10 flex-wrap items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                    <p className="shrink-0 text-sm font-medium">每页</p>
                    <Select
                        value={`${pageSize}`}
                        onValueChange={(value) => {
                            updateUrl(1, Number(value));
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
                        onClick={() => updateUrl(1)}
                        disabled={page <= 1}
                    >
                        <span className="sr-only">首页</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-9 min-h-9 w-9 shrink-0 touch-manipulation lg:h-8 lg:w-8"
                        onClick={() => updateUrl(page - 1)}
                        disabled={page <= 1}
                    >
                        <span className="sr-only">上一页</span>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-9 min-h-9 w-9 shrink-0 touch-manipulation lg:h-8 lg:w-8"
                        onClick={() => updateUrl(page + 1)}
                        disabled={page >= pageCount}
                    >
                        <span className="sr-only">下一页</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="hidden h-9 min-h-9 w-9 shrink-0 touch-manipulation lg:flex lg:h-8 lg:w-8"
                        onClick={() => updateUrl(pageCount)}
                        disabled={page >= pageCount}
                    >
                        <span className="sr-only">末页</span>
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
