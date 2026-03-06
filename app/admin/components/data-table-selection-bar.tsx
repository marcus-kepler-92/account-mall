"use client";

import { Table } from "@tanstack/react-table";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DataTableSelectionBarProps<TData> {
    table: Table<TData>;
    children?: React.ReactNode;
}

export function DataTableSelectionBar<TData>({
    table,
    children,
}: DataTableSelectionBarProps<TData>) {
    const selectedCount = table.getFilteredSelectedRowModel().rows.length;

    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2">
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                    已选择 <span className="font-medium text-foreground">{selectedCount}</span> 项
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => table.resetRowSelection()}
                >
                    <X className="mr-1 h-3 w-3" />
                    清空选择
                </Button>
            </div>
            <div className="flex items-center gap-2">
                {children}
            </div>
        </div>
    );
}
