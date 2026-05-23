"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    useReactTable,
    getCoreRowModel,
    VisibilityState,
    RowSelectionState,
} from "@tanstack/react-table";
import { XCircle, Trash2, Loader2, TimerOff } from "lucide-react";

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
import { createOrdersColumns, type OrderRow } from "./orders-columns"
import type { DistributorOption } from "./order-distributor-cell";
import { useQueryStates, parseAsInteger } from "nuqs"
import type { SortingState, Updater } from "@tanstack/react-table"
import { sortQueryStates, parseSortingState, encodeSortingState } from "@/lib/table-sort"

const SORT_DEFAULTS = { sort: "createdAt", sortDir: "desc" } as const

interface OrdersDataTableProps {
    data: OrderRow[];
    total: number;
    statusCounts: {
        PENDING: number;
        COMPLETED: number;
        CLOSED: number;
    };
    distributors: DistributorOption[];
    canReassignDistributor: boolean;
    isSuperAdmin?: boolean;
}

const statusOptions = [
    { label: "待完成", value: "PENDING" },
    { label: "待发货", value: "AWAITING_FULFILLMENT" },
    { label: "发货中", value: "PROCESSING" },
    { label: "已完成", value: "COMPLETED" },
    { label: "已关闭", value: "CLOSED" },
];

export function OrdersDataTable({ data, total, statusCounts, distributors, canReassignDistributor, isSuperAdmin = false }: OrdersDataTableProps) {
    const router = useRouter();
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchAction, setBatchAction] = useState<"CLOSE" | "DELETE" | null>(null);
    const [closeExpiredLoading, setCloseExpiredLoading] = useState(false);

    const [isPending, startTransition] = useTransition()
    const [sortState, setSortState] = useQueryStates(
        { ...sortQueryStates, page: parseAsInteger },
        { history: "push", shallow: false, startTransition }
    )
    const sorting: SortingState = parseSortingState(sortState.sort, sortState.sortDir, SORT_DEFAULTS)

    const columns = useMemo(() => createOrdersColumns(distributors, canReassignDistributor), [distributors, canReassignDistributor]);

    const table = useReactTable({
        data,
        columns,
        state: {
            columnVisibility,
            rowSelection,
            sorting,
        },
        enableRowSelection: true,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        manualSorting: true,
        onSortingChange: (updater: Updater<SortingState>) => {
            const next = typeof updater === "function" ? updater(sorting) : updater
            setSortState({ ...encodeSortingState(next, SORT_DEFAULTS), page: null })
        },
        getRowId: (row) => row.id,
        manualPagination: true,
        manualFiltering: true,
    });

    const selectedRows = table.getSelectedRowModel().rows;
    const selectedOrders = selectedRows.map((row) => row.original);

    const pendingSelected = selectedOrders.filter((o) => o.status === "PENDING");
    const closedSelected = selectedOrders.filter((o) => o.status === "CLOSED");

    const canBatchClose = pendingSelected.length > 0;
    const canBatchDelete = closedSelected.length > 0;

    const handleBatchAction = async (action: "CLOSE" | "DELETE") => {
        const ids = action === "CLOSE"
            ? pendingSelected.map((o) => o.id)
            : closedSelected.map((o) => o.id);

        if (ids.length === 0) {
            toast.error("没有可操作的订单");
            return;
        }

        setBatchLoading(true);
        try {
            const res = await fetch("/api/orders/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, orderIds: ids }),
            });
            const result = await res.json();
            if (!res.ok) {
                toast.error(result.error || "操作失败");
                return;
            }
            const actionLabel = action === "CLOSE" ? "关闭" : "删除";
            toast.success(`成功${actionLabel} ${result.success} 笔${result.skipped > 0 ? `，跳过 ${result.skipped} 笔` : ""}`);
            setRowSelection({});
            setBatchAction(null);
            router.refresh();
        } catch {
            toast.error("操作失败");
        } finally {
            setBatchLoading(false);
        }
    };

    const handleCloseExpired = async () => {
        setCloseExpiredLoading(true);
        try {
            const res = await fetch("/api/admin/close-expired-orders", { method: "POST" });
            const result = await res.json();
            if (!res.ok) {
                toast.error(result.error || "操作失败");
                return;
            }
            if (result.closed === 0) {
                toast.info("没有需要关闭的过期订单");
            } else {
                toast.success(`已关闭 ${result.closed} 笔过期订单`);
                router.refresh();
            }
        } catch {
            toast.error("操作失败");
        } finally {
            setCloseExpiredLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">订单列表</CardTitle>
                    {isSuperAdmin && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCloseExpired}
                            disabled={closeExpiredLoading}
                        >
                            {closeExpiredLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <TimerOff className="mr-2 h-4 w-4" />
                            )}
                            关闭过期订单
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
                <DataTableToolbar
                    table={table}
                    searchPlaceholder="搜索邮箱或订单号..."
                    searchParamKey="search"
                    statusOptions={statusOptions}
                    statusParamKey="status"
                />

                <DataTableSelectionBar table={table}>
                    {canBatchClose && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBatchAction("CLOSE")}
                            disabled={batchLoading}
                        >
                            <XCircle className="mr-2 h-4 w-4" />
                            批量关闭 ({pendingSelected.length})
                        </Button>
                    )}
                    {canBatchDelete && isSuperAdmin && (
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
                            批量删除 ({closedSelected.length})
                        </Button>
                    )}
                </DataTableSelectionBar>

                <Separator />
                <div className={isPending ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
                    <DataTable table={table} columns={columns} emptyMessage="暂无订单" />
                    <DataTablePagination table={table} total={total} />
                </div>
            </CardContent>

            <AlertDialog open={batchAction !== null} onOpenChange={(open) => !open && setBatchAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            确认{batchAction === "CLOSE" ? "关闭" : "删除"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {batchAction === "CLOSE" && (
                                <>确定要关闭选中的 {pendingSelected.length} 笔待完成订单吗？</>
                            )}
                            {batchAction === "DELETE" && (
                                <>确定要删除选中的 {closedSelected.length} 笔已关闭订单吗？此操作无法撤销。</>
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
