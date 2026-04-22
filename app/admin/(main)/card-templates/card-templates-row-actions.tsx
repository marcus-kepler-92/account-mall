"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Pencil, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { cardTemplateSchema, type CardTemplateInput } from "@/lib/validations/card-template"
import { parseTemplate } from "@/lib/card-format"
import type { CardTemplateRow } from "./card-templates-columns"

export function CardTemplateRowActions({ row }: { row: CardTemplateRow }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<CardTemplateInput>({
    resolver: zodResolver(cardTemplateSchema),
    defaultValues: { name: row.name, template: row.template },
  })

  const templateValue = form.watch("template")
  const parsedPreview = parseTemplate(templateValue)

  const handleEdit = async (data: CardTemplateInput) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/card-templates/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error((json as { error?: string }).error ?? "保存失败")
        return
      }
      toast.success("模版已更新")
      setEditOpen(false)
      router.refresh()
    } catch {
      toast.error("操作失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/card-templates/${row.id}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error((json as { error?: string }).error ?? "删除失败")
        return
      }
      toast.success("模版已删除")
      setDeleteOpen(false)
      router.refresh()
    } catch {
      toast.error("删除失败，请重试")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex gap-1 justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => {
            form.reset({ name: row.name, template: row.template })
            setEditOpen(true)
          }}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑模版</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>模版名称</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：带密保版" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="template"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>格式模板</FormLabel>
                    <FormControl>
                      <Input placeholder="{账号}----{密码}----{密保朋友}" className="font-mono" {...field} />
                    </FormControl>
                    <FormDescription>
                      用 <code className="text-xs rounded bg-muted px-1">{"{字段名}"}</code> 标记字段，字段间字符为分隔符
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {parsedPreview && (
                <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    分隔符：<code className="font-mono text-xs bg-background border rounded px-1 ml-1">{parsedPreview.delimiter}</code>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedPreview.fields.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs">
                        <span className="text-muted-foreground">{i + 1}</span>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除模版「{row.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              {row._count.products > 0
                ? `该模版已被 ${row._count.products} 个商品使用，无法删除，请先在商品中移除。`
                : "此操作不可撤销。已导入的卡密不受影响，但展示时将退化为启发式解析或纯文本。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {row._count.products > 0 ? (
              <AlertDialogCancel>关闭</AlertDialogCancel>
            ) : (
              <>
                <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting && <Loader2 className="size-4 animate-spin" />}
                  删除
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
