"use client"

import { useState } from "react"
import { Package } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils"
import type { ResolvedCard } from "@/lib/card-format"
import { CardCompactActions } from "@/app/admin/(main)/cards/card-row-actions"
import { CardDetailSheet } from "@/app/admin/(main)/cards/card-detail-sheet"

type SerializedCard = {
  id: string
  content: string
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

  const selectedIndex = selectedCard
    ? cards.findIndex((c) => c.id === selectedCard.id)
    : -1

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
                    <span className="font-mono text-xs">{card.content}</span>
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

      <CardDetailSheet
        card={selectedCard}
        title={selectedIndex >= 0 ? `卡密 #${selectedIndex + 1}` : "卡密详情"}
        onClose={() => setSelectedCard(null)}
      />
    </>
  )
}
