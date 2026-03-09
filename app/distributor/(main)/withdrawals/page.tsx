import { redirect } from "next/navigation"
import Link from "next/link"
import { getDistributorSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { DistributorWithdrawalsPagination } from "./withdrawals-pagination"
import { EmptyState } from "@/app/components/empty-state"
import { Wallet } from "lucide-react"

export const dynamic = "force-dynamic"

const statusConfig: Record<string, { label: string; variant: "warning" | "success" | "destructive" }> = {
    PENDING: { label: "待处理", variant: "warning" },
    PAID: { label: "已打款", variant: "success" },
    REJECTED: { label: "已拒绝", variant: "destructive" },
}

export default async function DistributorWithdrawalsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>
}) {
    const session = await getDistributorSession()
    if (!session) redirect("/distributor/login")

    const user = session.user as { id: string }
    const params = await searchParams
    const page = Math.max(1, parseInt(params.page ?? "1", 10))
    const pageSize = 20

    const [withdrawals, total] = await Promise.all([
        prisma.withdrawal.findMany({
            where: { distributorId: user.id },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.withdrawal.count({ where: { distributorId: user.id } }),
    ])

    const totalPages = Math.ceil(total / pageSize) || 1

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight sm:text-2xl">提现记录</h1>
                    <p className="text-muted-foreground">申请提现与处理状态</p>
                </div>
                <Button asChild className="min-h-11 touch-manipulation">
                    <Link href="/distributor/commissions">申请提现</Link>
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>提现记录</CardTitle>
                    <CardDescription>共 {total} 条，打款由管理员线下处理</CardDescription>
                </CardHeader>
                <CardContent>
                    {withdrawals.length === 0 ? (
                        <EmptyState
                            icon={<Wallet className="size-8 text-muted-foreground" />}
                            title="暂无提现记录"
                            description="在「我的佣金」页可提现余额处填写金额并上传收款码，提交后记录将在此展示。"
                            action={
                                <Button asChild>
                                    <Link href="/distributor/commissions">去申请提现</Link>
                                </Button>
                            }
                        />
                    ) : (
                        <>
                            <div className="overflow-x-auto rounded-md border [-webkit-overflow-scrolling:touch]">
                                <Table>
                                    <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right">金额</TableHead>
                                        <TableHead>状态</TableHead>
                                        <TableHead>申请时间</TableHead>
                                        <TableHead>处理时间</TableHead>
                                        <TableHead>备注</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {withdrawals.map((w) => (
                                        <TableRow key={w.id}>
                                            <TableCell className="text-right font-medium">
                                                ¥{Number(w.amount).toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={statusConfig[w.status]?.variant ?? "outline"}>
                                                    {statusConfig[w.status]?.label ?? w.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(w.createdAt).toLocaleString("zh-CN")}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {w.processedAt
                                                    ? new Date(w.processedAt).toLocaleString("zh-CN")
                                                    : "—"}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                                {w.note || "—"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                </Table>
                            </div>
                            {totalPages > 1 && (
                                <DistributorWithdrawalsPagination
                                    page={page}
                                    totalPages={totalPages}
                                    total={total}
                                />
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
