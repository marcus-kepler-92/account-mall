"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    useReactTable,
    getCoreRowModel,
    VisibilityState,
    RowSelectionState,
} from "@tanstack/react-table";
import { useQueryStates, parseAsInteger } from "nuqs";
import type { SortingState, Updater } from "@tanstack/react-table";
import { Trash2, PowerOff, CircleDot, Loader2 } from "lucide-react";
import { sortQueryStates, parseSortingState, encodeSortingState } from "@/lib/table-sort";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DataTable,
    DataTableToolbar,
    DataTablePagination,
    DataTableSelectionBar,
} from "@/app/admin/components";
import { cardsColumns, type CardRow } from "./cards-columns";

import type { ReactNode } from "react";

interface CardsDataTableProps {
    data: CardRow[];
    total: number;
    statusCounts: {
        UNSOLD: number;
        RESERVED: number;
        SOLD: number;
        DISABLED: number;
    };
    actions?: ReactNode;
}

const statusOptions = [
    { label: "未售", value: "UNSOLD" },
    { label: "预占中", value: "RESERVED" },
    { label: "已售", value: "SOLD" },
    { label: "停用", value: "DISABLED" },
];

const SORT_DEFAULTS = { sort: "createdAt", sortDir: "desc" } as const;

export function CardsDataTable({ data, total, statusCounts, actions }: CardsDataTableProps) {
    const router = useRouter();
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchAction, setBatchAction] = useState<"DELETE" | "DISABLE" | "ENABLE" | null>(null);
    const [isPending, startTransition] = useTransition()
    const [sortState, setSortState] = useQueryStates(
        { ...sortQueryStates, page: parseAsInteger },
        { history: "push", shallow: false, startTransition }
    );
    const sorting: SortingState = parseSortingState(sortState.sort, sortState.sortDir, SORT_DEFAULTS);

    const table = useReactTable({
        data,
        columns: cardsColumns,
        state: {
            columnVisibility,
            rowSelection,
            sorting,
        },
        enableRowSelection: true,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
        manualPagination: true,
        manualFiltering: true,
        manualSorting: true,
        onSortingChange: (updater: Updater<SortingState>) => {
            const next = typeof updater === "function" ? updater(sorting) : updater;
            setSortState({ ...encodeSortingState(next, SORT_DEFAULTS), page: null });
        },
    });

    const selectedRows = table.getSelectedRowModel().rows;
    const selectedCards = selectedRows.map((row) => row.original);
    const selectedIds = selectedCards.map((card) => card.id);

    const unsoldSelected = selectedCards.filter((c) => c.status === "UNSOLD");
    const disabledSelected = selectedCards.filter((c) => c.status === "DISABLED");

    const canBatchDelete = unsoldSelected.length > 0;
    const canBatchDisable = unsoldSelected.length > 0;
    const canBatchEnable = disabledSelected.length > 0;

    const handleBatchAction = async (action: "DELETE" | "DISABLE" | "ENABLE") => {
        const ids = action === "ENABLE" 
            ? disabledSelected.map((c) => c.id)
            : unsoldSelected.map((c) => c.id);
        
        if (ids.length === 0) {
            toast.error("没有可操作的卡密");
            return;
        }

        setBatchLoading(true);
        try {
            const res = await fetch("/api/cards/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, cardIds: ids }),
            });
            const result = await res.json();
            if (!res.ok) {
                toast.error(result.error || "操作失败");
                return;
            }
            const actionLabel = action === "DELETE" ? "删除" : action === "DISABLE" ? "停用" : "启用";
            toast.success(`成功${actionLabel} ${result.success} 条${result.skipped > 0 ? `，跳过 ${result.skipped} 条` : ""}`);
            setRowSelection({});
            router.refresh();
        } catch {
            toast.error("操作失败");
        } finally {
            setBatchLoading(false);
            setBatchAction(null);
        }
    };

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">卡密列表</CardTitle>
                    {actions}
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
                <DataTableToolbar
                    table={table}
                    searchPlaceholder="搜索卡密内容..."
                    searchParamKey="codeLike"
                    statusOptions={statusOptions}
                    statusParamKey="status"
                />

                <DataTableSelectionBar table={table}>
                    {canBatchDisable && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBatchAction("DISABLE")}
                            disabled={batchLoading}
                        >
                            <PowerOff className="mr-2 h-4 w-4" />
                            批量停用 ({unsoldSelected.length})
                        </Button>
                    )}
                    {canBatchEnable && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBatchAction("ENABLE")}
                            disabled={batchLoading}
                        >
                            <CircleDot className="mr-2 h-4 w-4" />
                            批量启用 ({disabledSelected.length})
                        </Button>
                    )}
                    {canBatchDelete && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBatchAction("DELETE")}
                            disabled={batchLoading}
                            className="text-destructive hover:text-destructive"
                        >
                            {batchLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            批量删除 ({unsoldSelected.length})
                        </Button>
                    )}
                </DataTableSelectionBar>

                <Separator />
                <div className={isPending ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
                    <DataTable table={table} columns={cardsColumns} emptyMessage="暂无卡密" />
                    <DataTablePagination table={table} total={total} />
                </div>
            </CardContent>

            <AlertDialog open={batchAction !== null} onOpenChange={(open) => !open && setBatchAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            确认{batchAction === "DELETE" ? "删除" : batchAction === "DISABLE" ? "停用" : "启用"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {batchAction === "DELETE" && (
                                <>确定要删除选中的 {unsoldSelected.length} 条未售卡密吗？此操作无法撤销。</>
                            )}
                            {batchAction === "DISABLE" && (
                                <>确定要停用选中的 {unsoldSelected.length} 条未售卡密吗？</>
                            )}
                            {batchAction === "ENABLE" && (
                                <>确定要启用选中的 {disabledSelected.length} 条停用卡密吗？</>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={batchLoading}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => batchAction && handleBatchAction(batchAction)}
                            disabled={batchLoading}
                            className={batchAction === "DELETE" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                        >
                            {batchLoading ? "处理中..." : "确认"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
