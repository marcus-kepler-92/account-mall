"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    MoreHorizontal,
    Copy,
    Eye,
    PowerOff,
    CircleDot,
    Trash2,
    ExternalLink,
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { DataTableColumnHeader } from "@/app/admin/components/data-table-column-header";

export type CardRow = {
    id: string;
    content: string;
    maskedContent: string;
    status: "UNSOLD" | "RESERVED" | "SOLD" | "DISABLED";
    orderNo: string | null;
    product: {
        id: string;
        name: string;
        slug: string;
    };
    createdAt: string;
};

const statusMap = {
    UNSOLD: { label: "未售", className: "border-success/50 bg-success/10 text-success" },
    RESERVED: { label: "预占中", className: "border-warning/50 bg-warning/10 text-warning" },
    SOLD: { label: "已售", className: "border-muted-foreground/30 bg-muted text-muted-foreground" },
    DISABLED: { label: "停用", className: "border-muted-foreground/30 bg-muted/50 text-muted-foreground" },
};

function CardRowActions({ card }: { card: CardRow }) {
    const router = useRouter();
    const [actionLoading, setActionLoading] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [viewDialogOpen, setViewDialogOpen] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(card.content);
            toast.success("已复制到剪贴板");
        } catch {
            toast.error("复制失败");
        }
    };

    const handleToggleStatus = async () => {
        const targetStatus = card.status === "UNSOLD" ? "DISABLED" : "UNSOLD";
        setActionLoading(true);
        try {
            const res = await fetch(`/api/cards/${card.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: targetStatus }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "操作失败");
                return;
            }
            toast.success(targetStatus === "DISABLED" ? "已停用" : "已启用");
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
            const res = await fetch(`/api/cards/${card.id}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "删除失败");
                return;
            }
            toast.success("已删除");
            router.refresh();
        } catch {
            toast.error("删除失败");
        } finally {
            setActionLoading(false);
            setDeleteDialogOpen(false);
        }
    };

    const canDelete = card.status === "UNSOLD";
    const canToggle = card.status === "UNSOLD" || card.status === "DISABLED";

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
                    <DropdownMenuItem onClick={handleCopy}>
                        <Copy className="mr-2 h-4 w-4" />
                        复制卡密
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setViewDialogOpen(true)}>
                        <Eye className="mr-2 h-4 w-4" />
                        查看完整内容
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href={`/admin/products/${card.product.id}/cards`}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            前往商品卡密页
                        </Link>
                    </DropdownMenuItem>
                    {canToggle && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleToggleStatus} disabled={actionLoading}>
                                {card.status === "UNSOLD" ? (
                                    <>
                                        <PowerOff className="mr-2 h-4 w-4" />
                                        停用
                                    </>
                                ) : (
                                    <>
                                        <CircleDot className="mr-2 h-4 w-4" />
                                        启用
                                    </>
                                )}
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

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除这条卡密吗？此操作无法撤销。
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

            <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>完整卡密内容</DialogTitle>
                        <DialogDescription>
                            商品：{card.product.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md bg-muted p-4 font-mono text-sm break-all">
                        {card.content}
                    </div>
                    <Button onClick={handleCopy} variant="outline" className="w-full">
                        <Copy className="mr-2 h-4 w-4" />
                        复制到剪贴板
                    </Button>
                </DialogContent>
            </Dialog>
        </>
    );
}

export const cardsColumns: ColumnDef<CardRow>[] = [
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
        accessorKey: "maskedContent",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="卡密" />
        ),
        cell: ({ row }) => (
            <span className="font-mono text-xs">{row.getValue("maskedContent")}</span>
        ),
    },
    {
        accessorKey: "product",
        header: "商品",
        cell: ({ row }) => {
            const product = row.original.product;
            return (
                <div className="flex flex-col">
                    <Link
                        href={`/admin/products/${product.id}/cards`}
                        className="text-sm font-medium hover:underline"
                    >
                        {product.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">/{product.slug}</span>
                </div>
            );
        },
        enableSorting: false,
    },
    {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => {
            const status = row.getValue("status") as CardRow["status"];
            const { label, className } = statusMap[status];
            return (
                <Badge variant="outline" className={className}>
                    {label}
                </Badge>
            );
        },
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id));
        },
    },
    {
        accessorKey: "orderNo",
        header: "订单号",
        cell: ({ row }) => {
            const orderNo = row.getValue("orderNo") as string | null;
            return (
                <span className="text-xs text-muted-foreground font-mono">
                    {orderNo ?? "—"}
                </span>
            );
        },
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="创建时间" />
        ),
        cell: ({ row }) => {
            const date = row.getValue("createdAt") as string;
            return (
                <span className="text-xs text-muted-foreground">
                    {new Date(date).toLocaleString("zh-CN")}
                </span>
            );
        },
    },
    {
        id: "actions",
        cell: ({ row }) => <CardRowActions card={row.original} />,
    },
];
