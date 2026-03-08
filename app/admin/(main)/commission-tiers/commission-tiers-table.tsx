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
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, Trash2 } from "lucide-react"

export type TierRow = {
    id: string
    minAmount: number
    maxAmount: number
    ratePercent: number
    sortOrder: number
    createdAt: string
}

export function CommissionTiersTable({ data }: { data: TierRow[] }) {
    const router = useRouter()
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [confirmId, setConfirmId] = useState<string | null>(null)

    const handleDelete = async (id: string) => {
        setDeletingId(id)
        setConfirmId(null)
        try {
            const res = await fetch(`/api/admin/commission-tiers/${id}`, { method: "DELETE" })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || "删除失败")
                return
            }
            toast.success("已删除")
            router.refresh()
        } catch {
            toast.error("删除失败")
        } finally {
            setDeletingId(null)
        }
    }

    if (data.length === 0) {
        return (
            <p className="text-sm text-muted-foreground py-8 text-center">
                暂无阶梯档位，点击右上角「添加档位」创建。
            </p>
        )
    }

    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>排序</TableHead>
                        <TableHead className="text-right">当周销售额下限（元）</TableHead>
                        <TableHead className="text-right">当周销售额上限（元）</TableHead>
                        <TableHead className="text-right">佣金比例（%）</TableHead>
                        <TableHead className="w-[80px]">操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((t) => (
                        <TableRow key={t.id}>
                            <TableCell>{t.sortOrder}</TableCell>
                            <TableCell className="text-right">¥{t.minAmount.toFixed(2)}</TableCell>
                            <TableCell className="text-right">¥{t.maxAmount.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{t.ratePercent}%</TableCell>
                            <TableCell>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    disabled={deletingId === t.id}
                                    onClick={() => setConfirmId(t.id)}
                                >
                                    {deletingId === t.id ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="size-4" />
                                    )}
                                    删除
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除该阶梯档位吗？删除后不可恢复。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => confirmId && handleDelete(confirmId)}
                        >
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
