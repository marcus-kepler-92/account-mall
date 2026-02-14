"use client"

import Link from "next/link"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import type { RestockPendingRow } from "@/app/admin/(main)/dashboard/types"

export function DashboardRestockPending({
    data,
    basePath = "/admin/products",
}: {
    data: RestockPendingRow[]
    basePath?: string
}) {
    if (data.length === 0) {
        return (
            <p className="py-4 text-center text-sm text-muted-foreground">
                暂无待通知的到货提醒
            </p>
        )
    }
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>商品</TableHead>
                        <TableHead className="text-right">待通知人数</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((row) => (
                        <TableRow key={row.productId}>
                            <TableCell>
                                <Link
                                    href={`${basePath}/${row.productId}`}
                                    className="hover:underline"
                                >
                                    {row.productName}
                                </Link>
                            </TableCell>
                            <TableCell className="text-right">
                                {row.pendingCount}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
