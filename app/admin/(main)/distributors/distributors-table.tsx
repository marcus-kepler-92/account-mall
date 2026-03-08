"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, UserX, UserCheck } from "lucide-react"

export type DistributorRow = {
    id: string
    email: string
    name: string
    distributorCode: string | null
    disabledAt: string | null
    createdAt: string
    completedOrderCount: number
    totalCommission: number
    withdrawableBalance: number
}

export function DistributorsTable({ data }: { data: DistributorRow[] }) {
    const router = useRouter()
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    const handleToggleDisabled = async (id: string, currentlyDisabled: boolean) => {
        setUpdatingId(id)
        try {
            const res = await fetch(`/api/admin/distributors/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ disabled: !currentlyDisabled }),
            })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || "操作失败")
                return
            }
            toast.success(currentlyDisabled ? "已启用" : "已停用")
            router.refresh()
        } catch {
            toast.error("操作失败")
        } finally {
            setUpdatingId(null)
        }
    }

    if (data.length === 0) {
        return (
            <p className="text-sm text-muted-foreground py-8 text-center">
                暂无分销员，分销员可通过前台注册成为分销员。
            </p>
        )
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>昵称</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>优惠码</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">成交订单</TableHead>
                    <TableHead className="text-right">累计佣金</TableHead>
                    <TableHead className="text-right">可提现余额</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.map((d) => {
                    const disabled = !!d.disabledAt
                    const loading = updatingId === d.id
                    return (
                        <TableRow key={d.id}>
                            <TableCell className="font-medium">{d.name}</TableCell>
                            <TableCell className="text-muted-foreground">{d.email}</TableCell>
                            <TableCell>
                                {d.distributorCode ? (
                                    <code className="text-xs font-mono">{d.distributorCode}</code>
                                ) : (
                                    "—"
                                )}
                            </TableCell>
                            <TableCell>
                                <Badge variant={disabled ? "destructive" : "default"}>
                                    {disabled ? "已停用" : "启用"}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">{d.completedOrderCount}</TableCell>
                            <TableCell className="text-right">
                                ¥{d.totalCommission.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                                ¥{d.withdrawableBalance.toFixed(2)}
                            </TableCell>
                            <TableCell>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={loading}
                                    onClick={() => handleToggleDisabled(d.id, disabled)}
                                >
                                    {loading ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : disabled ? (
                                        <UserCheck className="size-4" />
                                    ) : (
                                        <UserX className="size-4" />
                                    )}
                                    <span className="ml-1">{disabled ? "启用" : "停用"}</span>
                                </Button>
                            </TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>
    )
}
