"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { Bell, X } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { NotificationBadge } from "./notification-badge"
import {
  useAdminNotifications,
  useDismissAdminNotifications,
} from "@/app/admin/hooks/use-admin-notifications"
import { SOURCES, type SourceKey, type SourceResult } from "@/lib/admin-notifications"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "刚刚"
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  return `${day} 天前`
}

type DismissFn = (args: { sourceKey: SourceKey; itemId: string; fingerprint: string }) => void

function Row({
  sourceKey,
  itemId,
  fingerprint,
  onDismiss,
  children,
}: {
  sourceKey: SourceKey
  itemId: string
  fingerprint: string
  onDismiss: DismissFn
  children: ReactNode
}) {
  return (
    <div className="group/notif-row -mx-2 flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/50">
      <Link
        href="/admin/notifications"
        className="block min-w-0 flex-1 hover:underline"
      >
        {children}
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "size-6 shrink-0 text-muted-foreground hover:text-foreground",
          "opacity-0 transition-opacity group-hover/notif-row:opacity-100 focus-visible:opacity-100",
        )}
        aria-label="标记已读"
        onClick={(e) => {
          // Prevent the wrapping Link from navigating when the user clicks the X.
          e.preventDefault()
          e.stopPropagation()
          onDismiss({ sourceKey, itemId, fingerprint })
        }}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

const POPOVER_ITEM_LIMIT = 3

function renderItems(source: SourceResult, onDismiss: DismissFn): ReactNode {
  switch (source.key) {
    case "withdrawals":
      return source.items.slice(0, POPOVER_ITEM_LIMIT).map((it) => (
        <Row
          key={it.id}
          sourceKey={source.key}
          itemId={it.id}
          fingerprint={it.fingerprint}
          onDismiss={onDismiss}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{it.distributorName} · {formatCurrency(it.amount)}</span>
            <span className="text-muted-foreground tabular-nums shrink-0">{timeAgo(it.createdAt)}</span>
          </div>
        </Row>
      ))
    case "agentLeads":
      return source.items.slice(0, POPOVER_ITEM_LIMIT).map((it) => (
        <Row
          key={it.id}
          sourceKey={source.key}
          itemId={it.id}
          fingerprint={it.fingerprint}
          onDismiss={onDismiss}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">
              {it.displayName} · {it.status}
              {it.urgency === "HIGH" ? " · 紧急" : ""}
            </span>
            <span className="text-muted-foreground tabular-nums shrink-0">{timeAgo(it.createdAt)}</span>
          </div>
        </Row>
      ))
    case "inventoryAlerts":
      return source.items.slice(0, POPOVER_ITEM_LIMIT).map((it) => {
        const label =
          it.subtype === "RESTOCK_WAITING"
            ? `缺货 · ${it.subscriberCount} 人等待`
            : it.subtype === "OUT_OF_STOCK"
              ? "缺货"
              : `低库存（剩 ${it.unsoldCount}）`
        return (
          <Row
            key={it.id}
            sourceKey={source.key}
            itemId={it.id}
            fingerprint={it.fingerprint}
            onDismiss={onDismiss}
          >
            <span className="truncate">{it.productName} · {label}</span>
          </Row>
        )
      })
    case "manualPendingOrders":
      return source.items.slice(0, POPOVER_ITEM_LIMIT).map((it) => {
        const waitMin = Math.max(
          0,
          Math.floor((Date.now() - new Date(it.createdAt).getTime()) / 60_000),
        )
        const waitLabel =
          waitMin < 60
            ? `${waitMin} 分钟`
            : waitMin < 60 * 24
              ? `${Math.floor(waitMin / 60)} 小时`
              : `${Math.floor(waitMin / (60 * 24))} 天`
        const display = it.variantName ?? it.productName
        return (
          <Row
            key={it.id}
            sourceKey={source.key}
            itemId={it.id}
            fingerprint={it.fingerprint}
            onDismiss={onDismiss}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">
                {display} · {formatCurrency(it.amount)}
              </span>
              <span className="text-muted-foreground tabular-nums shrink-0">
                已等 {waitLabel}
              </span>
            </div>
            {it.dunCount > 0 && (
              <div className="mt-0.5 text-xs font-medium text-destructive">
                已催 {it.dunCount} 次
              </div>
            )}
          </Row>
        )
      })
  }
}

export function NotificationCenterPopover() {
  const { byKey, totalCount } = useAdminNotifications()
  const dismiss = useDismissAdminNotifications()
  const onDismiss: DismissFn = (args) => dismiss.mutate([args])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-w-9 touch-manipulation"
          aria-label={totalCount > 0 ? `${totalCount} 项待办` : "通知中心"}
        >
          <Bell className="size-4" />
          <NotificationBadge variant="dot" count={totalCount} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <Link
              href="/admin/notifications"
              className="font-medium hover:underline"
            >
              通知中心
            </Link>
            {totalCount > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {totalCount} 项待办
              </span>
            )}
          </div>
          {totalCount > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              点击通知或顶部标题进入「通知中心」；悬停点 × 标记单条已读
            </p>
          )}
        </div>
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          {totalCount === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              ✨ 暂无待办
            </div>
          ) : (
            SOURCES.map((src, idx) => {
              const data = byKey[src.key]
              if (!data || data.count === 0) return null
              const Icon = src.icon
              const breakdownLine =
                data.key === "inventoryAlerts" ? (
                  <div className="text-xs text-muted-foreground mb-2">
                    {[
                      data.breakdown.outOfStock > 0 ? `${data.breakdown.outOfStock} 款缺货` : null,
                      data.breakdown.lowStock > 0 ? `${data.breakdown.lowStock} 款低库存` : null,
                      data.breakdown.restockWaiting > 0
                        ? `${data.breakdown.restockWaiting} 款等到货提醒`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                ) : null
              return (
                <div key={src.key}>
                  {idx > 0 ? <Separator /> : null}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="size-4" />
                        {src.label}
                      </div>
                    </div>
                    {breakdownLine}
                    <div className="space-y-0.5">{renderItems(data, onDismiss)}</div>
                    <Link
                      href="/admin/notifications"
                      className="mt-2 inline-block text-xs text-primary hover:underline"
                    >
                      查看全部 →
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
