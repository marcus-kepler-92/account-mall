"use client"

import { useState, useCallback, useRef } from "react"
import { Check, Copy, Package } from "lucide-react"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatDateTime } from "@/lib/utils"
import type { ResolvedCard } from "@/lib/card-format"
import { CardCompactActions } from "@/app/admin/(main)/cards/card-row-actions"

type SerializedCard = {
  id: string
  content: string
  maskedContent: string
  status: string
  createdAt: string
  productId: string
  resolved: ResolvedCard
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  UNSOLD: { label: "未售", className: "border-success/50 bg-success/10 text-success" },
  RESERVED: { label: "预占中", className: "border-warning/50 bg-warning/10 text-warning" },
  DISABLED: {
    label: "停用",
    className: "border-muted-foreground/30 bg-muted/50 text-muted-foreground",
  },
  SOLD: {
    label: "已售",
    className: "border-muted-foreground/30 bg-muted text-muted-foreground",
  },
}

export function OrderCardsTable({ cards }: { cards: SerializedCard[] }) {
  const [selectedCard, setSelectedCard] = useState<SerializedCard | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const selectedIndex = selectedCard
    ? cards.findIndex((c) => c.id === selectedCard.id)
    : -1

  const copy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      clearTimeout(copiedTimerRef.current)
      setCopiedId(id)
      copiedTimerRef.current = setTimeout(() => setCopiedId(null), 2000)
      toast.success("已复制")
    } catch {
      toast.error("复制失败")
    }
  }, [])

  const copyAll = useCallback(
    async (card: SerializedCard) => {
      const text =
        card.resolved.type === "formatted"
          ? card.resolved.fields.map((f) => `${f.label}：${f.value}`).join("\n")
          : card.content
      try {
        await navigator.clipboard.writeText(text)
        toast.success("已复制全部")
      } catch {
        toast.error("复制失败")
      }
    },
    [],
  )

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="size-10 text-muted-foreground mb-2" />
        <p className="text-sm font-medium">暂无卡密</p>
        <p className="text-xs text-muted-foreground mt-1">该订单尚未关联卡密</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="pl-4">卡密</TableHead>
              <TableHead className="text-center">状态</TableHead>
              <TableHead className="hidden text-right sm:table-cell">创建时间</TableHead>
              <TableHead className="text-right pr-4 w-[120px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.map((card) => {
              const statusInfo = STATUS_MAP[card.status] ?? STATUS_MAP.SOLD
              return (
                <TableRow
                  key={card.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedCard(card)}
                >
                  <TableCell className="pl-4">
                    <span className="font-mono text-xs">{card.maskedContent}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={statusInfo.className}>
                      {statusInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground text-xs sm:table-cell">
                    {formatDateTime(card.createdAt)}
                  </TableCell>
                  <TableCell
                    className="text-right pr-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <CardCompactActions
                      cardId={card.id}
                      content={card.content}
                      status={card.status}
                      productId={card.productId}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selectedCard && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="flex items-center gap-2">
                  卡密 #{selectedIndex + 1}
                  <Badge
                    variant="outline"
                    className={STATUS_MAP[selectedCard.status]?.className}
                  >
                    {STATUS_MAP[selectedCard.status]?.label}
                  </Badge>
                </SheetTitle>
              </SheetHeader>

              {selectedCard.resolved.type === "formatted" ? (
                <div className="space-y-4">
                  <div className="rounded-lg border divide-y divide-border/60">
                    {selectedCard.resolved.fields.map((field, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <span className="text-xs font-medium text-muted-foreground shrink-0 w-20">
                          {field.label}
                        </span>
                        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                          <code className="min-w-0 break-all font-mono text-sm text-foreground">
                            {field.value}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                            onClick={() => copy(field.value, `field-${i}`)}
                            aria-label={`复制${field.label}`}
                          >
                            {copiedId === `field-${i}` ? (
                              <Check className="size-4 text-emerald-600" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full gap-2"
                    onClick={() => copyAll(selectedCard)}
                  >
                    <Copy className="size-4" />
                    复制全部
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <code className="break-all font-mono text-sm text-foreground">
                      {selectedCard.resolved.content}
                    </code>
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full gap-2"
                    onClick={() => copyAll(selectedCard)}
                  >
                    <Copy className="size-4" />
                    复制
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
