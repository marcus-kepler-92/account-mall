"use client"

import { ColumnDef } from "@tanstack/react-table"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { MoreHorizontal, UserCheck, UserX, Copy, Loader2, Percent } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { DataTableColumnHeader } from "@/app/admin/components/data-table-column-header"
import { EditDiscountDialog } from "./edit-discount-dialog"

export type DistributorRow = {
    id: string
    email: string
    name: string
    distributorCode: string | null
    discountCodeEnabled: boolean
    discountPercent: number | null
    disabledAt: string | null
    createdAt: string
    completedOrderCount: number
    totalCommission: number
    level1CommissionTotal: number
    level2CommissionTotal: number
    level1Settled: number
    level2Settled: number
    paidTotal: number
    pendingTotal: number
    withdrawableBalance: number
    inviteeCount: number
    inviter: { id: string; name: string; distributorCode: string | null } | null
}

function BalanceTooltip({ row }: { row: DistributorRow }) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="cursor-default underline decoration-dashed underline-offset-2">
                        ¥{row.withdrawableBalance.toFixed(2)}
                    </span>
                </TooltipTrigger>
                <TooltipContent className="w-56 text-xs space-y-1 p-3">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">一级佣金（已结算）</span>
                        <span>¥{row.level1Settled.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">二级佣金（已结算）</span>
                        <span>¥{row.level2Settled.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between">
                        <span className="text-muted-foreground">已打款</span>
                        <span>-¥{row.paidTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">提现中</span>
                        <span>-¥{row.pendingTotal.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-medium">
                        <span>可提现余额</span>
                        <span>¥{row.withdrawableBalance.toFixed(2)}</span>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

function CommissionTooltip({ row }: { row: DistributorRow }) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="cursor-default underline decoration-dashed underline-offset-2">
                        ¥{row.totalCommission.toFixed(2)}
                    </span>
                </TooltipTrigger>
                <TooltipContent className="w-48 text-xs space-y-1 p-3">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">一级佣金</span>
                        <span>¥{row.level1CommissionTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">二级佣金</span>
                        <span>¥{row.level2CommissionTotal.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-medium">
                        <span>合计</span>
                        <span>¥{row.totalCommission.toFixed(2)}</span>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

function DistributorRowActions({ row }: { row: DistributorRow }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [discountOpen, setDiscountOpen] = useState(false)
    const disabled = !!row.disabledAt

    const handleToggle = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/distributors/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ disabled: !disabled }),
            })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || "操作失败")
                return
            }
            toast.success(disabled ? "已启用" : "已停用")
            router.refresh()
        } catch {
            toast.error("操作失败")
        } finally {
            setLoading(false)
        }
    }

    const handleCopyCode = async () => {
        if (!row.distributorCode) return
        try {
            await navigator.clipboard.writeText(row.distributorCode)
            toast.success("已复制推荐码")
        } catch {
            toast.error("复制失败")
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0" disabled={loading}>
                        <span className="sr-only">打开菜单</span>
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <MoreHorizontal className="h-4 w-4" />
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleToggle}>
                        {disabled ? (
                            <>
                                <UserCheck className="mr-2 h-4 w-4" />
                                启用
                            </>
                        ) : (
                            <>
                                <UserX className="mr-2 h-4 w-4" />
                                停用
                            </>
                        )}
                    </DropdownMenuItem>
                    {row.distributorCode && (
                        <DropdownMenuItem onClick={handleCopyCode}>
                            <Copy className="mr-2 h-4 w-4" />
                            复制推荐码
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setDiscountOpen(true)}>
                        <Percent className="mr-2 h-4 w-4" />
                        优惠码设置
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <EditDiscountDialog
                open={discountOpen}
                onOpenChange={setDiscountOpen}
                distributorId={row.id}
                distributorCode={row.distributorCode}
                discountCodeEnabled={row.discountCodeEnabled}
                discountPercent={row.discountPercent}
                onSuccess={() => router.refresh()}
            />
        </>
    )
}

export const distributorsColumns: ColumnDef<DistributorRow>[] = [
    {
        accessorKey: "name",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="昵称" />
        ),
        cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
        ),
    },
    {
        accessorKey: "email",
        header: "邮箱",
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {row.original.email}
            </span>
        ),
    },
    {
        accessorKey: "distributorCode",
        header: "推荐码",
        cell: ({ row }) =>
            row.original.distributorCode ? (
                <code className="text-xs font-mono">{row.original.distributorCode}</code>
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
    },
    {
        accessorKey: "inviter",
        header: "上线",
        cell: ({ row }) => {
            const inv = row.original.inviter
            if (!inv) return <span className="text-muted-foreground">—</span>
            return (
                <span className="text-sm">
                    {inv.name}
                    {inv.distributorCode && (
                        <span className="text-muted-foreground font-mono ml-1 text-xs">
                            {inv.distributorCode}
                        </span>
                    )}
                </span>
            )
        },
    },
    {
        accessorKey: "inviteeCount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="下线数" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right text-muted-foreground">
                {row.original.inviteeCount}
            </div>
        ),
    },
    {
        accessorKey: "discountCodeEnabled",
        header: "优惠码",
        cell: ({ row }) =>
            row.original.discountCodeEnabled ? (
                <Badge variant="secondary">已启用</Badge>
            ) : (
                <span className="text-muted-foreground text-sm">关闭</span>
            ),
    },
    {
        accessorKey: "discountPercent",
        header: "折扣比例",
        cell: ({ row }) =>
            row.original.discountPercent != null ? (
                <span className="tabular-nums">{row.original.discountPercent}%</span>
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
    },
    {
        accessorKey: "disabledAt",
        header: "状态",
        cell: ({ row }) => {
            const disabled = !!row.original.disabledAt
            return (
                <Badge variant={disabled ? "destructive" : "default"}>
                    {disabled ? "已停用" : "启用"}
                </Badge>
            )
        },
    },
    {
        accessorKey: "completedOrderCount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="成交订单" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right">{row.original.completedOrderCount}</div>
        ),
    },
    {
        accessorKey: "totalCommission",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="累计佣金" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right font-medium">
                <CommissionTooltip row={row.original} />
            </div>
        ),
    },
    {
        accessorKey: "withdrawableBalance",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="可提现余额" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right font-medium">
                <BalanceTooltip row={row.original} />
            </div>
        ),
    },
    {
        id: "actions",
        cell: ({ row }) => <DistributorRowActions row={row.original} />,
        enableSorting: false,
        enableHiding: false,
    },
]
