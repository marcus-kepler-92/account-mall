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
import { Badge } from "@/components/ui/badge"
import type { InventoryRow } from "@/app/admin/(main)/dashboard/types"

export function DashboardInventoryAlerts({
    data,
    basePath = "/admin/products",
}: {
    data: InventoryRow[]
    basePath?: string
}) {
    if (data.length === 0) {
        return (
            <p className="py-6 text-center text-sm text-muted-foreground">
                暂无商品库存数据
            </p>
        )
    }
    const sorted = [...data].sort((a, b) => a.unsoldCount - b.unsoldCount)
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>商品</TableHead>
                        <TableHead className="text-right">库存</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sorted.map((row) => (
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
                                {row.isLowStock ? (
                                    <Badge variant="destructive">
                                        {row.unsoldCount}（低库存）
                                    </Badge>
                                ) : (
                                    row.unsoldCount
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
