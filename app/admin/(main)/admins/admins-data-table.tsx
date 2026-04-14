"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Copy, Check, Plus, Loader2 } from "lucide-react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DataTable, PageHeader } from "@/app/admin/components"
import { adminsColumns, type AdminRow } from "./admins-columns"
import { ADMIN_ROLE_CONFIG, type AdminSubRole } from "@/lib/admin-permissions"

interface AdminsDataTableProps {
  data: AdminRow[]
}

function CreateAdminDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [adminRole, setAdminRole] = useState<string>("__super__")
  const [result, setResult] = useState<{ password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          adminRole: adminRole === "__super__" ? null : adminRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error ?? "创建失败")
        return
      }
      setResult({ password: data.password })
      onCreated()
    } catch {
      toast.error("创建失败")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setOpen(false)
    setResult(null)
    setEmail("")
    setName("")
    setAdminRole("__super__")
    setCopied(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4 mr-1" />
          新增管理员
        </Button>
      </DialogTrigger>
      <DialogContent>
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle>新增管理员</DialogTitle>
              <DialogDescription>系统将自动生成初始密码，管理员首次登录时需要修改。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>邮箱</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>姓名</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="管理员姓名" />
              </div>
              <div className="space-y-1.5">
                <Label>角色</Label>
                <Select value={adminRole} onValueChange={setAdminRole}>
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>取消</Button>
              <Button onClick={handleCreate} disabled={loading || !email || !name}>
                {loading && <Loader2 className="size-4 mr-1 animate-spin" />}
                创建
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>管理员已创建</DialogTitle>
              <DialogDescription>以下是初始密码，仅显示一次。请妥善保管并告知管理员。</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 font-mono text-sm">
              <span className="flex-1 select-all">{result.password}</span>
              <Button variant="ghost" size="icon" className="size-7" onClick={handleCopy}>
                {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>完成</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function AdminsDataTable({ data }: AdminsDataTableProps) {
  const router = useRouter()
  const [globalFilter, setGlobalFilter] = useState("")

  const table = useReactTable({
    data,
    columns: adminsColumns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  })

  return (
    <div className="space-y-4">
      <PageHeader title="管理员管理" description="管理后台管理员账号及其权限角色">
        <CreateAdminDialog onCreated={() => router.refresh()} />
      </PageHeader>
      <div className="flex items-center gap-2">
        <Input
          placeholder="搜索姓名或邮箱..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <DataTable table={table} columns={adminsColumns} />
    </div>
  )
}
