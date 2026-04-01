"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { formatDateTime } from "@/lib/utils"
import { CampaignRowActions } from "./campaign-row-actions"

export type CampaignRow = {
  id: string
  name: string
  subject: string
  status: "DRAFT" | "SENDING" | "SENT" | "FAILED"
  recipientType: "CUSTOMERS" | "DISTRIBUTORS"
  recipientCount: number
  successCount: number
  failCount: number
  sentAt: string | null
  createdAt: string
  template: { id: string; title: string } | null
}

const statusConfig: Record<CampaignRow["status"], { label: string; variant: "secondary" | "default" | "destructive" | "outline" }> = {
  DRAFT: { label: "草稿", variant: "secondary" },
  SENDING: { label: "发送中", variant: "outline" },
  SENT: { label: "已发送", variant: "default" },
  FAILED: { label: "失败", variant: "destructive" },
}

const recipientTypeLabel: Record<CampaignRow["recipientType"], string> = {
  CUSTOMERS: "客户",
  DISTRIBUTORS: "分销员",
}

export const campaignsColumns: ColumnDef<CampaignRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="活动名称" />,
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[200px]">
        <p className="font-medium truncate">{row.original.name}</p>
        <p className="text-xs text-muted-foreground truncate">{row.original.subject}</p>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "状态",
    cell: ({ row }) => {
      const { label, variant } = statusConfig[row.original.status]
      return (
        <div className="flex items-center gap-1.5">
          <Badge variant={variant}>{label}</Badge>
          {row.original.status === "SENT" && row.original.failCount > 0 && (
            <Badge variant="outline" className="text-orange-500 border-orange-300">
              {row.original.failCount} 失败
            </Badge>
          )}
        </div>
      )
    },
    filterFn: (row, id, value: string) => !value || row.getValue(id) === value,
  },
  {
    accessorKey: "recipientType",
    header: "受众",
    cell: ({ row }) => (
      <span className="text-sm">{recipientTypeLabel[row.original.recipientType]}</span>
    ),
  },
  {
    id: "counts",
    header: "发送情况",
    cell: ({ row }) => {
      const { status, recipientCount, successCount, failCount } = row.original
      if (status === "DRAFT") return <span className="text-muted-foreground text-sm">—</span>
      return (
        <div className="text-sm space-y-0.5">
          <p>共 {recipientCount} 人</p>
          {(status === "SENT" || status === "FAILED") && (
            <p className="text-xs text-muted-foreground">
              成功 {successCount} / 失败 {failCount}
            </p>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="创建时间" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">{formatDateTime(row.original.createdAt)}</span>
    ),
  },
  {
    id: "actions",
    header: () => <div className="text-right">操作</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <CampaignRowActions id={row.original.id} name={row.original.name} status={row.original.status} />
      </div>
    ),
  },
]
