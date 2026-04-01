"use client"

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { formatDateTime } from "@/lib/utils"
import { TemplateCardActions } from "./template-card-actions"

type TemplateItem = {
  id: string
  title: string
  description: string | null
  html: string
  createdAt: string
}

export function TemplatesGrid({ templates }: { templates: TemplateItem[] }) {
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <p className="text-muted-foreground text-sm">暂无模板，点击「新建模板」开始创建</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <Card key={template.id} className="flex flex-col overflow-hidden">
          {/* HTML preview */}
          <div className="border-b bg-muted/30 h-40 overflow-hidden relative">
            <iframe
              srcDoc={template.html}
              className="absolute inset-0 w-full h-full scale-[0.4] origin-top-left pointer-events-none"
              style={{ width: "250%", height: "250%" }}
              sandbox="allow-same-origin"
              title={template.title}
            />
          </div>

          <CardHeader className="pb-2 pt-3">
            <p className="font-medium truncate text-sm">{template.title}</p>
            {template.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{template.description}</p>
            )}
          </CardHeader>

          <CardContent className="pb-2 pt-0 flex-1" />

          <CardFooter className="pt-0 pb-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{formatDateTime(template.createdAt)}</span>
            <TemplateCardActions
              id={template.id}
              title={template.title}
            />
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
