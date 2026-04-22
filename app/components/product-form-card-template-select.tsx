"use client"

import { useState } from "react"
import { useFormContext } from "react-hook-form"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Plus, X } from "lucide-react"
import { parseTemplate } from "@/lib/card-format"
import type { ProductFormSchema } from "@/lib/validations/product"

type CardTemplate = { id: string; name: string; template: string }

export function ProductFormCardTemplateSelect({
  initialTemplates,
}: {
  initialTemplates: CardTemplate[]
}) {
  const { watch, setValue, getValues } = useFormContext<ProductFormSchema>()
  const templateIds = (watch("cardTemplateIds") ?? []) as string[]

  const [templates, setTemplates] = useState<CardTemplate[]>(initialTemplates)
  const [newName, setNewName] = useState("")
  const [newTemplate, setNewTemplate] = useState("")
  const [creating, setCreating] = useState(false)

  const parsedPreview = parseTemplate(newTemplate)

  const toggleTemplate = (id: string) => {
    const next = templateIds.includes(id)
      ? templateIds.filter((t) => t !== id)
      : [...templateIds, id]
    setValue("cardTemplateIds", next)
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newTemplate.trim()) return
    if (!parseTemplate(newTemplate)) {
      toast.error("模板格式无效，请至少包含两个 {字段名} 和分隔符")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/admin/card-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), template: newTemplate.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error((data as { error?: string }).error ?? "创建模版失败")
        return
      }
      const created = await res.json() as CardTemplate
      setTemplates((prev) => [...prev, created])
      const current = (getValues("cardTemplateIds") ?? []) as string[]
      setValue("cardTemplateIds", [...current, created.id])
      setNewName("")
      setNewTemplate("")
      toast.success("模版已创建并选中")
    } catch {
      toast.error("创建模版失败")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>卡密模版</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {templates.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {templates.map((t) => {
              const parsed = parseTemplate(t.template)
              return (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                >
                  <Checkbox
                    checked={templateIds.includes(t.id)}
                    onCheckedChange={() => toggleTemplate(t.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{t.template}</div>
                    {parsed && (
                      <div className="text-xs text-muted-foreground">{parsed.fields.length} 字段</div>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        )}

        {templateIds.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2 border-t">
            {templateIds.map((id) => {
              const t = templates.find((x) => x.id === id)
              return t ? (
                <Badge key={id} variant="secondary" className="gap-1 pr-1">
                  {t.name}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-0.5 size-5 rounded-full p-0 hover:bg-muted-foreground/20"
                    onClick={() => toggleTemplate(id)}
                    aria-label="移除模版"
                  >
                    <X className="size-3" />
                  </Button>
                </Badge>
              ) : null
            })}
          </div>
        )}

        <div className="space-y-2 pt-2 border-t">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="模版名称..."
            className="h-8 text-sm"
          />
          <div className="flex items-center gap-2">
            <Input
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              placeholder="{账号}----{密码}"
              className="h-8 text-sm font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleCreate() }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCreate}
              disabled={creating || !newName.trim() || !newTemplate.trim()}
            >
              {creating ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
            </Button>
          </div>
          {parsedPreview && newTemplate && (
            <p className="text-xs text-muted-foreground">
              {parsedPreview.fields.join(" · ")}（{parsedPreview.fields.length} 字段）
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
