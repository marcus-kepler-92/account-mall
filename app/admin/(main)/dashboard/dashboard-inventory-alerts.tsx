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
import type { InventoryRow } from "./types"
import { LOW_STOCK_THRESHOLD } from "./types"

function stockTier(row: InventoryRow): number {
  if (row.unsoldCount === 0) return 0
  if (row.isLowStock) return 1
  return 2
}

function compareInventoryRows(a: InventoryRow, b: InventoryRow): number {
  const ta = stockTier(a)
  const tb = stockTier(b)
  if (ta !== tb) return ta - tb
  if (a.unsoldCount !== b.unsoldCount) return a.unsoldCount - b.unsoldCount
  return a.productName.localeCompare(b.productName, "zh-CN")
}

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
        暂无上架中的普通商品（自动获取类不在此展示；若仅有下架商品也会显示此项）
      </p>
    )
  }

  const sorted = [...data].sort(compareInventoryRows)
  const outOfStock = data.filter((r) => r.unsoldCount === 0).length
  const lowNotZero = data.filter((r) => r.unsoldCount > 0 && r.isLowStock).length
  const ok = data.length - outOfStock - lowNotZero

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        共 {data.length} 款上架中的普通商品（不含自动获取）
        {outOfStock > 0 ? ` · ${outOfStock} 款缺货` : ""}
        {lowNotZero > 0
          ? ` · ${lowNotZero} 款低库存（可售低于 ${LOW_STOCK_THRESHOLD}）`
          : ""}
        {ok > 0 && outOfStock + lowNotZero > 0 ? ` · ${ok} 款充足` : ""}
        {outOfStock === 0 && lowNotZero === 0 ? " · 库存均不低于预警线" : ""}
      </p>
      <div className="max-h-70 overflow-y-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>商品</TableHead>
              <TableHead className="text-right">可售库存</TableHead>
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
                  {row.unsoldCount === 0 ? (
                    <Badge variant="destructive">0 · 缺货</Badge>
                  ) : row.isLowStock ? (
                    <Badge variant="destructive">
                      {row.unsoldCount} · 低库存
                    </Badge>
                  ) : (
                    <span className="tabular-nums text-muted-foreground">
                      {row.unsoldCount}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
