"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { formatDateTime } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ADMIN_ROLE_CONFIG } from "@/lib/admin-permissions"
import { AdminsRowActions } from "./admins-row-actions"

export type AdminRow = {
  id: string
  email: string | null
  username: string | null
  name: string
  adminRole: string | null
  createdAt: string
}

function roleLabel(adminRole: string | null): string {
  if (!adminRole) return "超级管理员"
  return (ADMIN_ROLE_CONFIG as Record<string, { label: string }>)[adminRole]?.label ?? adminRole
}

export const adminsColumns: ColumnDef<AdminRow>[] = [
  {
    accessorKey: "name",
    header: "姓名",
  },
  {
    accessorKey: "email",
    header: "邮箱",
    cell: ({ row }) => row.original.email ?? "—",
  },
  {
    accessorKey: "username",
    header: "用户名",
    cell: ({ row }) => row.original.username ?? "—",
  },
  {
    accessorKey: "adminRole",
    header: "角色",
    cell: ({ row }) => {
      const label = roleLabel(row.original.adminRole)
      return (
        <Badge variant={row.original.adminRole === null ? "default" : "secondary"}>
          {label}
        </Badge>
      )
    },
  },
  {
    accessorKey: "createdAt",
    header: "创建时间",
    cell: ({ row }) => formatDateTime(new Date(row.original.createdAt)),
  },
  {
    id: "actions",
    cell: ({ row }) => <AdminsRowActions row={row.original} />,
  },
]
