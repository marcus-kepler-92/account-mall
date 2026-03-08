"use client"

import { useState } from "react"
import Link from "next/link"
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle, XCircle, Wallet } from "lucide-react"
import { EmptyState } from "@/app/components/empty-state"

export type WithdrawalRow = {
    id: string
    distributorId: string
    distributor: { id: string; email: string; name: string }
    amount: number
    status: string
    receiptImageUrl: string | null
    note: string | null
    processedAt: string | null
    createdAt: string
}

const statusMap: Record<string, { label: string; variant: "warning" | "success" | "destructive" }> = {
    PENDING: { label: "待处理", variant: "warning" },
    PAID: { label: "已打款", variant: "success" },
    REJECTED: { label: "已拒绝", variant: "destructive" },
}

export function WithdrawalsTable({
    data,
    currentStatus,
}: {
    data: WithdrawalRow[]
    currentStatus: string | null
}) {
    const router = useRouter()
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [dialog, setDialog] = useState<{
        id: string
        action: "PAID" | "REJECTED"
        note: string
    } | null>(null)
    const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null)

    const handleSubmit = async () => {
        if (!dialog) return
        const { id, action, note } = dialog
        setLoadingId(id)
        try {
            const res = await fetch(`/api/admin/withdrawals/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: action, note: note || undefined }),
            })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || "操作失败")
                return
            }
            toast.success(action === "PAID" ? "已标记打款" : "已拒绝")
            setDialog(null)
            router.refresh()
        } catch {
            toast.error("操作失败")
        } finally {
            setLoadingId(null)
        }
    }

    if (data.length === 0) {
        return (
            <EmptyState
                icon={<Wallet className="size-8 text-muted-foreground" />}
                title={currentStatus ? "该状态下暂无记录" : "暂无提现记录"}
                description={
                    currentStatus
                        ? "当前筛选条件下没有提现记录，可查看全部状态。"
                        : "分销员申请提现后，记录将在此展示。"
                }
                action={
                    currentStatus ? (
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/admin/withdrawals">查看全部状态</Link>
                        </Button>
                    ) : undefined
                }
            />
        )
    }

    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>分销员</TableHead>
                        <TableHead className="text-right">金额</TableHead>
                        <TableHead>收款码</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>申请时间</TableHead>
                        <TableHead>备注</TableHead>
                        <TableHead className="w-[180px]">操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((w) => {
                        const { label, variant } = statusMap[w.status] ?? {
                            label: w.status,
                            variant: "outline" as const,
                        }
                        const loading = loadingId === w.id
                        return (
                            <TableRow key={w.id}>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{w.distributor.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {w.distributor.email}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    ¥{w.amount.toFixed(2)}
                                </TableCell>
                                <TableCell>
                                    {w.receiptImageUrl ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-primary hover:underline"
                                            onClick={() => setReceiptPreviewUrl(w.receiptImageUrl)}
                                        >
                                            查看
                                        </Button>
                                    ) : (
                                        <span className="text-muted-foreground text-sm">—</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={variant}>{label}</Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {new Date(w.createdAt).toLocaleString("zh-CN")}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                    {w.note || "—"}
                                </TableCell>
                                <TableCell>
                                    {w.status === "PENDING" && (
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={loading}
                                                onClick={() =>
                                                    setDialog({
                                                        id: w.id,
                                                        action: "PAID",
                                                        note: "",
                                                    })
                                                }
                                            >
                                                {loading ? (
                                                    <Loader2 className="size-4 animate-spin" />
                                                ) : (
                                                    <CheckCircle className="size-4" />
                                                )}
                                                标记已打款
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-destructive hover:text-destructive"
                                                disabled={loading}
                                                onClick={() =>
                                                    setDialog({
                                                        id: w.id,
                                                        action: "REJECTED",
                                                        note: "",
                                                    })
                                                }
                                            >
                                                <XCircle className="size-4" />
                                                拒绝
                                            </Button>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
            <Dialog
                open={!!receiptPreviewUrl}
                onOpenChange={(open) => !open && setReceiptPreviewUrl(null)}
            >
                <DialogContent className="max-w-[90vw] sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>收款码</DialogTitle>
                        <DialogDescription>分销员上传的收款码，打款时请核对</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center overflow-hidden rounded-md border bg-muted/30 p-4">
                        {receiptPreviewUrl && (
                            <img
                                src={receiptPreviewUrl}
                                alt="收款码"
                                className="max-h-[60vh] max-w-full object-contain"
                            />
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setReceiptPreviewUrl(null)}>关闭</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {dialog?.action === "PAID" ? "标记已打款" : "拒绝提现"}
                        </DialogTitle>
                        <DialogDescription>
                            {dialog?.action === "PAID"
                                ? "请填写打款方式或流水号等备注（可选）"
                                : "请填写拒绝原因（可选）"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <Label>备注</Label>
                        <Input
                            value={dialog?.note ?? ""}
                            onChange={(e) =>
                                dialog && setDialog({ ...dialog, note: e.target.value })
                            }
                            placeholder={
                                dialog?.action === "PAID"
                                    ? "打款方式、流水号等"
                                    : "拒绝原因"
                            }
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialog(null)}>
                            取消
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={loadingId !== null}
                        >
                            {loadingId ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : dialog?.action === "PAID" ? (
                                "确认已打款"
                            ) : (
                                "确认拒绝"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
