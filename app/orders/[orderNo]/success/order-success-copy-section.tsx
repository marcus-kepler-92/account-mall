"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import { toast } from "sonner"
import type { ResolvedCard } from "@/lib/card-format"

type OrderSuccessCopySectionProps = {
  cards: ResolvedCard[]
}

export function OrderSuccessCopySection({ cards }: OrderSuccessCopySectionProps) {
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyAll = async () => {
    if (cards.length === 0) return
    const lines = cards.map((card) => {
      if (card.type === "formatted") {
        return card.fields.map((f) => `${f.label}：${f.value}`).join("\n")
      }
      return card.content
    })
    try {
      await navigator.clipboard.writeText(lines.join("\n\n"))
      setCopiedAll(true)
      toast.success(`已复制 ${cards.length} 条卡密`)
      setTimeout(() => setCopiedAll(false), 2000)
    } catch {
      toast.error("复制失败，请手动复制")
    }
  }

  const copyOne = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      toast.success("已复制")
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error("复制失败")
    }
  }

  if (cards.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无卡密数据</p>
  }

  const isMultiCard = cards.length > 1

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="secondary"
        className="w-full gap-2"
        onClick={copyAll}
      >
        {copiedAll ? <Check className="size-4" /> : <Copy className="size-4" />}
        一键复制全部卡密（{cards.length} 条）
      </Button>

      <ul className={isMultiCard ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-2"}>
        {cards.map((card, i) => {
          if (card.type === "formatted") {
            const copyText = card.fields.map((f) => `${f.label}：${f.value}`).join("\n")
            return (
              <li
                key={i}
                className="rounded-lg border border-border/80 bg-card shadow-sm overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/30 border-b border-border/60">
                  <span className="text-xs text-muted-foreground">№{i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => copyOne(copyText, `card-${i}`)}
                  >
                    {copiedId === `card-${i}` ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    复制
                  </Button>
                </div>
                <div className="divide-y divide-border/60">
                  {card.fields.map((field, j) => (
                    <div
                      key={j}
                      className="flex items-center justify-between gap-4 px-4 py-2.5"
                    >
                      <span className="text-xs font-medium text-muted-foreground shrink-0 w-20">
                        {field.label}
                      </span>
                      <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                        <code className="min-w-0 break-all font-mono text-sm text-foreground">
                          {field.value}
                        </code>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 rounded-full hover:bg-muted"
                          onClick={() => copyOne(field.value, `field-${i}-${j}`)}
                          aria-label={`复制${field.label}`}
                        >
                          {copiedId === `field-${i}-${j}` ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </li>
            )
          }

          return (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 font-mono text-sm"
            >
              <span className="min-w-0 flex-1 break-words">{card.content}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => copyOne(card.content, `plain-${i}`)}
              >
                {copiedId === `plain-${i}` ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
