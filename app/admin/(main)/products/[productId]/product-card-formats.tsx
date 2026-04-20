"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Pencil, Trash2, Plus, Loader2 } from "lucide-react"
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
import { cardFormatSchema, type CardFormatInput } from "@/lib/validations/card-format"
import { parseTemplate } from "@/lib/card-format"

type CardFormat = {
  id: string
  name: string
  template: string
  sortOrder: number
}

type ProductCardFormatsProps = {
  productId: string
  initialFormats: CardFormat[]
}

export function ProductCardFormats({ productId, initialFormats }: ProductCardFormatsProps) {
  const router = useRouter()
  const [formats, setFormats] = useState<CardFormat[]>(initialFormats)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFormat, setEditingFormat] = useState<CardFormat | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CardFormat | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<CardFormatInput>({
    resolver: zodResolver(cardFormatSchema),
    defaultValues: { name: "", template: "" },
  })

  const templateValue = form.watch("template")
  const parsedPreview = parseTemplate(templateValue)

  const openAdd = () => {
    setEditingFormat(null)
    form.reset({ name: "", template: "" })
    setDialogOpen(true)
  }

  const openEdit = (fmt: CardFormat) => {
    setEditingFormat(fmt)
    form.reset({ name: fmt.name, template: fmt.template })
    setDialogOpen(true)
  }

  const handleSubmit = async (data: CardFormatInput) => {
    setSubmitting(true)
    try {
      const url = editingFormat
        ? `/api/products/${productId}/card-formats/${editingFormat.id}`
        : `/api/products/${productId}/card-formats`
      const method = editingFormat ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error((json as { error?: string }).error ?? "保存失败")
        return
      }
      toast.success(editingFormat ? "格式已更新" : "格式已添加")
      setDialogOpen(false)
      if (editingFormat) {
        setFormats((prev) => prev.map((f) => (f.id === editingFormat.id ? { ...f, ...data } : f)))
      } else {
        const created = json as { id: string; name: string; template: string; sortOrder: number }
        setFormats((prev) => [...prev, { id: created.id, name: created.name, template: created.template, sortOrder: created.sortOrder }])
      }
      router.refresh()
    } catch {
      toast.error("操作失败，请重试")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/api/products/${productId}/card-formats/${deleteTarget.id}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error((json as { error?: string }).error ?? "删除失败")
        return
      }
      toast.success("格式已删除")
      setFormats((prev) => prev.filter((f) => f.id !== deleteTarget.id))
      setDeleteTarget(null)
      router.refresh()
    } catch {
      toast.error("删除失败，请重试")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">卡密格式</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            定义卡密字段结构，展示时按格式解析。多格式按字段数量自动匹配。
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="size-4" />
          添加格式
        </Button>
      </div>

      {formats.length > 0 && (
        <div className="rounded-md border divide-y text-sm">
          {formats.map((fmt) => {
            const preview = parseTemplate(fmt.template)
            return (
              <div key={fmt.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-24 shrink-0 font-medium truncate">{fmt.name}</span>
                <span className="flex-1 font-mono text-xs text-muted-foreground truncate">
                  {fmt.template}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {preview ? `${preview.fields.length} 字段` : "—"}
                </span>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(fmt)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(fmt)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFormat ? "编辑格式" : "添加卡密格式"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>格式名称</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：带密保版" {...field} />
                    </FormControl>
                    <FormDescription>仅用于内部识别，不对用户展示</FormDescription>
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
                      <Input
                        placeholder="{账号}----{密码}----{密保朋友}"
                        className="font-mono"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      用{" "}
                      <code className="text-xs rounded bg-muted px-1">{"{字段名}"}</code>{" "}
                      标记每个字段，字段间字符为分隔符
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {parsedPreview && (
                <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    分隔符：
                    <code className="font-mono text-xs bg-background border rounded px-1 ml-1">
                      {parsedPreview.delimiter}
                    </code>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedPreview.fields.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs"
                      >
                        <span className="text-muted-foreground">{i + 1}</span>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除格式「{deleteTarget?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销。已导入的卡密不受影响，但展示时将退化为启发式解析或纯文本。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
