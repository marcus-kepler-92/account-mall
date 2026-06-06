"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MoreHorizontal, KeyRound, UserCog, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ADMIN_ROLE_CONFIG, type AdminSubRole } from "@/lib/admin-role-config"
import { PasswordRevealDialog } from "@/app/admin/components"
import type { AdminRow } from "./admins-columns"

interface AdminsRowActionsProps {
  row: AdminRow
}

export function AdminsRowActions({ row }: AdminsRowActionsProps) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>(row.adminRole ?? "__super__")
  const [revealPassword, setRevealPassword] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleUpdateRole = async () => {
    setLoading(true)
    const adminRole = selectedRole === "__super__" ? null : selectedRole
    try {
      const res = await fetch(`/api/admin/admins/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateRole", adminRole }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? "操作失败")
        return
      }
      toast.success("角色已更新")
      setRoleOpen(false)
      router.refresh()
    } catch {
      toast.error("操作失败")
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/admins/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetPassword" }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? "操作失败")
        return
      }
      const data = await res.json()
      setRevealPassword(data.password)
    } catch {
      toast.error("操作失败")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/admins/${row.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? "删除失败")
        return
      }
      toast.success("管理员已删除")
      router.refresh()
    } catch {
      toast.error("删除失败")
    } finally {
      setLoading(false)
      setDeleteOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setRoleOpen(true)}>
            <UserCog className="size-4 mr-2" />
            修改角色
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleResetPassword} disabled={loading}>
            <KeyRound className="size-4 mr-2" />
            重置密码
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4 mr-2" />
            删除账号
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改角色</DialogTitle>
            <DialogDescription>{row.name}（{row.email}）</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>子角色</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__super__">超级管理员</SelectItem>
                {(Object.entries(ADMIN_ROLE_CONFIG) as [AdminSubRole, { label: string }][]).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleOpen(false)}>取消</Button>
            <Button onClick={handleUpdateRole} disabled={loading}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除管理员账号 <span className="font-medium">{row.name}</span>（{row.email}）。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {revealPassword && (
        <PasswordRevealDialog
          password={revealPassword}
          open={true}
          onClose={() => setRevealPassword(null)}
          description="这是一次性密码，仅显示一次。管理员下次登录时需要修改密码。"
        />
      )}
    </>
  )
}
