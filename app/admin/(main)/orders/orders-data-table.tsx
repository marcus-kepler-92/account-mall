"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    useReactTable,
    getCoreRowModel,
    VisibilityState,
    RowSelectionState,
} from "@tanstack/react-table";
import { XCircle, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    DataTableFacetedFilter,
    DataTableSelectionBar,
} from "@/app/admin/components";
import { ordersColumns, type OrderRow } from "./orders-columns";

interface OrdersDataTableProps {
    data: OrderRow[];
    total: number;
    statusCounts: {
        PENDING: number;
        COMPLETED: number;
        CLOSED: number;
    };
}

const statusOptions = [
    { label: "待完成", value: "PENDING" },
    { label: "已完成", value: "COMPLETED" },
    { label: "已关闭", value: "CLOSED" },
];

export function OrdersDataTable({ data, total, statusCounts }: OrdersDataTableProps) {
    const router = useRouter();
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchAction, setBatchAction] = useState<"CLOSE" | "DELETE" | null>(null);

    const table = useReactTable({
        data,
        columns: ordersColumns,
        state: {
            columnVisibility,
            rowSelection,
        },
        enableRowSelection: true,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
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

    const statusOptionsWithCounts = statusOptions.map((opt) => ({
        ...opt,
        count: statusCounts[opt.value as keyof typeof statusCounts],
    }));

    return (
        <div className="space-y-4">
            <DataTableToolbar
                table={table}
                searchPlaceholder="搜索邮箱或订单号..."
                searchParamKey="search"
            >
                <DataTableFacetedFilter
                    column={table.getColumn("status")}
                    title="状态"
                    options={statusOptionsWithCounts}
                    paramKey="status"
                />
            </DataTableToolbar>

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
                        批量删除 ({closedSelected.length})
                    </Button>
                )}
            </DataTableSelectionBar>

            <DataTable table={table} columns={ordersColumns} emptyMessage="暂无订单" />

            <DataTablePagination table={table} total={total} />

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
        </div>
    );
}
