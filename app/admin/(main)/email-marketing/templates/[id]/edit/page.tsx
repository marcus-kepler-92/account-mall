"use client"

import { useRef, useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/app/admin/components"
import { UnlayerEditor, type UnlayerEditorHandle } from "../../unlayer-editor"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

const formSchema = z.object({
  title: z.string().min(1, "模板名称不能为空"),
  defaultSubject: z.string().min(1, "默认主题不能为空"),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

type Template = {
  id: string
  title: string
  description: string | null
  defaultSubject: string
  unlayerDesign: Record<string, unknown>
}

export default function EditTemplatePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const editorRef = useRef<UnlayerEditorHandle | null>(null)
  const [template, setTemplate] = useState<Template | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", defaultSubject: "", description: "" },
  })

  useEffect(() => {
    fetch(`/api/admin/email-marketing/templates/${id}`)
      .then((r) => r.json())
      .then((data: Template) => {
        setTemplate(data)
        form.reset({
          title: data.title,
          defaultSubject: data.defaultSubject,
          description: data.description ?? "",
        })
      })
      .catch(() => toast.error("加载模板失败"))
  }, [id, form])

  const onSubmit = async (values: FormValues) => {
    if (!editorRef.current) {
      toast.error("编辑器未就绪，请稍候")
      return
    }

    const { design, html } = await editorRef.current.exportHtml()
    const res = await fetch(`/api/admin/email-marketing/templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: values.title,
        description: values.description || undefined,
        defaultSubject: values.defaultSubject,
        unlayerDesign: design,
        html,
      }),
    })

    if (res.ok) {
      toast.success("模板已更新")
      router.push("/admin/email-marketing/templates")
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data?.error ?? "保存失败")
    }
  }

  if (!template) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-16 sm:col-span-2" />
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/email-marketing/templates">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <PageHeader title="编辑模板" description={template.title} />
          </div>
          <Button type="submit" disabled={form.formState.isSubmitting} size="sm">
            {form.formState.isSubmitting
              ? <Loader2 className="size-4 animate-spin" />
              : <Save className="size-4" />}
            保存更改
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>模板名称</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="defaultSubject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>默认主题</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>描述（选填）</FormLabel>
                <FormControl>
                  <Textarea rows={2} className="resize-none" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <UnlayerEditor editorRef={editorRef} initialDesign={template.unlayerDesign} />
      </form>
    </Form>
  )
}
