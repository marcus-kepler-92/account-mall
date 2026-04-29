"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

export function CardTemplatesCreateButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const form = useForm<CardTemplateInput>({
    resolver: zodResolver(cardTemplateSchema),
    defaultValues: { name: "", template: "" },
  })

  const templateValue = form.watch("template")
  const parsedPreview = parseTemplate(templateValue)

  const handleCreate = async (data: CardTemplateInput) => {
    setCreating(true)
    try {
      const res = await fetch("/api/admin/card-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error((json as { error?: string }).error ?? "创建失败")
        return
      }
      toast.success("模版已创建")
      form.reset({ name: "", template: "" })
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("操作失败，请重试")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          新建模版
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>新建卡密模版</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
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
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>取消</Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="size-4 animate-spin" />}
                创建
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
