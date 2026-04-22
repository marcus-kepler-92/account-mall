"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/app/admin/components"
import { parseTemplate } from "@/lib/card-format"
import { CardTemplateRowActions } from "./card-templates-row-actions"

export type CardTemplateRow = {
  id: string
  name: string
  template: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  _count: { products: number }
}

export const cardTemplatesColumns: ColumnDef<CardTemplateRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="名称" />,
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    accessorKey: "template",
    header: "模版字符串",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">{row.original.template}</span>
    ),
  },
  {
    id: "fields",
    header: "字段数",
    cell: ({ row }) => {
      const parsed = parseTemplate(row.original.template)
      return (
        <span className="tabular-nums text-sm">
          {parsed ? `${parsed.fields.length} 字段` : "—"}
        </span>
      )
    },
  },
  {
    id: "products",
    header: "使用商品数",
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original._count.products}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => <CardTemplateRowActions row={row.original} />,
  },
]
