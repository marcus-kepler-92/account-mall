"use client";

import { ColumnDef } from "@tanstack/react-table";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
    MoreHorizontal,
    Eye,
    Copy,
    XCircle,
    Trash2,
    Loader2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { DataTableColumnHeader } from "@/app/admin/components/data-table-column-header";

export type OrderRow = {
    id: string;
    orderNo: string;
    email: string;
    distributorId: string | null;
    distributor: { id: string; name: string; distributorCode: string | null } | null;
    product: {
        id: string;
        name: string;
        price: number;
    };
    quantity: number;
    amount: number;
    status: "PENDING" | "COMPLETED" | "CLOSED";
    paymentMethod: string | null;
    paidAt: string | null;
    createdAt: string;
    cardsCount: number;
    reservedCardsCount: number;
    soldCardsCount: number;
};

const statusMap = {
    PENDING: { label: "待完成", variant: "warning" as const },
    COMPLETED: { label: "已完成", variant: "success" as const },
    CLOSED: { label: "已关闭", variant: "secondary" as const },
};

function OrderRowActions({ order }: { order: OrderRow }) {
    const router = useRouter();
    const [actionLoading, setActionLoading] = useState(false);
    const [closeDialogOpen, setCloseDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const handleCopyOrderNo = async () => {
        try {
            await navigator.clipboard.writeText(order.orderNo);
            toast.success("已复制订单号");
        } catch {
            toast.error("复制失败");
        }
    };

    const handleClose = async () => {
        setActionLoading(true);
        try {
            const res = await fetch("/api/orders/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "CLOSE", orderIds: [order.id] }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "关闭失败");
                return;
            }
            toast.success("订单已关闭");
            setCloseDialogOpen(false);
            router.refresh();
        } catch {
            toast.error("操作失败");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        setActionLoading(true);
        try {
            const res = await fetch("/api/orders/batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "DELETE", orderIds: [order.id] }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "删除失败");
                return;
            }
            toast.success("订单已删除");
            setDeleteDialogOpen(false);
            router.refresh();
        } catch {
            toast.error("操作失败");
        } finally {
            setActionLoading(false);
        }
    };

    const canClose = order.status === "PENDING";
    const canDelete = order.status === "CLOSED";

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">打开菜单</span>
                        {actionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <MoreHorizontal className="h-4 w-4" />
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                        <Link href={`/admin/orders/${order.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            查看详情
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyOrderNo}>
                        <Copy className="mr-2 h-4 w-4" />
                        复制订单号
                    </DropdownMenuItem>
                    {canClose && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setCloseDialogOpen(true)} disabled={actionLoading}>
                                <XCircle className="mr-2 h-4 w-4" />
                                关闭订单
                            </DropdownMenuItem>
                        </>
                    )}
                    {canDelete && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteDialogOpen(true)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认关闭订单</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要关闭订单 {order.orderNo} 吗？关闭后订单状态将变为「已关闭」。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClose} disabled={actionLoading}>
                            {actionLoading ? "处理中..." : "确认关闭"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除订单 {order.orderNo} 吗？此操作无法撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={actionLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {actionLoading ? "删除中..." : "删除"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export const ordersColumns: ColumnDef<OrderRow>[] = [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="全选"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="选择行"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "orderNo",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="订单号" />
        ),
        cell: ({ row }) => (
            <Link
                href={`/admin/orders/${row.original.id}`}
                className="font-mono text-xs hover:underline"
            >
                {row.original.orderNo}
            </Link>
        ),
    },
    {
        accessorKey: "email",
        header: "邮箱",
        cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
                {row.getValue("email") as string}
            </span>
        ),
    },
    {
        accessorKey: "distributor",
        header: "分销员",
        cell: ({ row }) => {
            const d = row.original.distributor;
            if (!d) return <span className="text-muted-foreground">—</span>;
            return (
                <div className="flex flex-col text-xs">
                    <span>{d.name}</span>
                    {d.distributorCode && (
                        <span className="text-muted-foreground font-mono">{d.distributorCode}</span>
                    )}
                </div>
            );
        },
        enableSorting: false,
    },
    {
        accessorKey: "product",
        header: "商品",
        cell: ({ row }) => {
            const product = row.original.product;
            return (
                <div className="flex flex-col">
                    <span className="font-medium">{product.name}</span>
                    <span className="text-xs text-muted-foreground">
                        ¥{product.price.toFixed(2)}
                    </span>
                </div>
            );
        },
        enableSorting: false,
    },
    {
        accessorKey: "quantity",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="数量" />
        ),
        cell: ({ row }) => (
            <span className="text-right">{row.getValue("quantity") as number}</span>
        ),
    },
    {
        accessorKey: "amount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="金额" />
        ),
        cell: ({ row }) => (
            <span className="text-right font-medium">
                ¥{(row.getValue("amount") as number).toFixed(2)}
            </span>
        ),
    },
    {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => {
            const status = row.getValue("status") as OrderRow["status"];
            const { label, variant } = statusMap[status];
            return <Badge variant={variant}>{label}</Badge>;
        },
        filterFn: (row, id, value) => {
            const val = row.getValue(id) as string;
            return value.includes(val);
        },
    },
    {
        id: "cards",
        header: "卡密",
        cell: ({ row }) => {
            const o = row.original;
            return (
                <span className="text-xs text-muted-foreground">
                    {o.soldCardsCount}/{o.cardsCount} 已售
                </span>
            );
        },
        enableSorting: false,
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="创建时间" />
        ),
        cell: ({ row }) => {
            const createdAt = row.getValue("createdAt") as string;
            const paidAt = row.original.paidAt;
            const paymentMethod = row.original.paymentMethod;
            const pmLabel = paymentMethod === "wxpay" ? "微信" : paymentMethod === "qqpay" ? "QQ钱包" : "支付宝";
            return (
                <div className="flex flex-col items-end text-xs">
                    <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{pmLabel}</span>
                        <span>{formatDateTime(createdAt)}</span>
                    </div>
                    {paidAt && (
                        <span className="text-muted-foreground">
                            支付于 {formatDateTime(paidAt)}
                        </span>
                    )}
                </div>
            );
        },
    },
    {
        id: "actions",
        cell: ({ row }) => <OrderRowActions order={row.original} />,
    },
];
