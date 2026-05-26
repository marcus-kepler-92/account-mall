"use client"

import Link from "next/link"
import { useState } from "react"
import {
    AlertCircle,
    Loader2,
    RotateCcw,
    X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { SOURCES, type SourceKey, type SourceResult } from "@/lib/admin-notifications"
import { formatCurrency } from "@/lib/utils"
import {
    useAdminNotifications,
    useDismissAdminNotifications,
    useDismissedNotifications,
    useRestoreNotifications,
} from "@/app/admin/hooks/use-admin-notifications"
import type { DismissedItem } from "@/app/api/admin/notifications/dismissed/route"

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

export function NotificationsClient() {
    const [tab, setTab] = useState<"unread" | "dismissed">("unread")

    return (
        <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as typeof tab)}
            className="gap-4"
        >
            <TabsList>
                <TabsTrigger value="unread">未读</TabsTrigger>
                <TabsTrigger value="dismissed">已读</TabsTrigger>
            </TabsList>
            <TabsContent value="unread">
                <UnreadPanel />
            </TabsContent>
            <TabsContent value="dismissed">
                <DismissedPanel />
            </TabsContent>
        </Tabs>
    )
}

function UnreadPanel() {
    const { sources, totalCount, isLoading } = useAdminNotifications()
    const dismiss = useDismissAdminNotifications()

    if (isLoading) {
        return <LoadingCard />
    }
    if (totalCount === 0) {
        return <EmptyCard message="✨ 暂无未读通知" />
    }

    return (
        <div className="space-y-4">
            {SOURCES.map((src) => {
                const data = sources.find((s) => s.key === src.key)
                if (!data || data.count === 0) return null
                const Icon = src.icon
                const itemIdsForBatch = (data.items as { id: string; fingerprint: string }[]).map(
                    (it) => ({ sourceKey: src.key, itemId: it.id, fingerprint: it.fingerprint }),
                )
                return (
                    <Card key={src.key} className="gap-0 py-0 overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between gap-3 py-4">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Icon className="size-4 text-muted-foreground" />
                                {src.label}
                                <Badge variant="secondary">{data.count}</Badge>
                            </CardTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={dismiss.isPending}
                                onClick={() => dismiss.mutate(itemIdsForBatch)}
                            >
                                全部已读
                            </Button>
                        </CardHeader>
                        <Separator />
                        <CardContent className="p-0">
                            <UnreadList
                                source={data}
                                onDismiss={(args) => dismiss.mutate([args])}
                            />
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}

type DismissArgs = { sourceKey: SourceKey; itemId: string; fingerprint: string }

function UnreadList({
    source,
    onDismiss,
}: {
    source: SourceResult
    onDismiss: (args: DismissArgs) => void
}) {
    return (
        <ul className="divide-y">
            {(source.items as Array<{ id: string; fingerprint: string }>).map((it) => (
                <UnreadRow
                    key={it.id}
                    source={source}
                    item={it}
                    onDismiss={() =>
                        onDismiss({
                            sourceKey: source.key,
                            itemId: it.id,
                            fingerprint: it.fingerprint,
                        })
                    }
                />
            ))}
        </ul>
    )
}

function UnreadRow({
    source,
    item,
    onDismiss,
}: {
    source: SourceResult
    item: { id: string; fingerprint: string }
    onDismiss: () => void
}) {
    return (
        <li className="group/notif-row flex items-center gap-3 px-6 py-3 text-sm transition-colors hover:bg-muted/40">
            <div className="min-w-0 flex-1">
                <UnreadRowContent source={source} itemId={item.id} />
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/notif-row:opacity-100 focus-visible:opacity-100"
                aria-label="标记已读"
                onClick={onDismiss}
            >
                <X className="size-3.5" />
            </Button>
        </li>
    )
}

function UnreadRowContent({
    source,
    itemId,
}: {
    source: SourceResult
    itemId: string
}) {
    switch (source.key) {
        case "withdrawals": {
            const it = source.items.find((x) => x.id === itemId)
            if (!it) return null
            return (
                <div className="flex items-center justify-between gap-3">
                    <span className="truncate">
                        {it.distributorName} · {formatCurrency(it.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {timeAgo(it.createdAt)}
                    </span>
                </div>
            )
        }
        case "agentLeads": {
            const it = source.items.find((x) => x.id === itemId)
            if (!it) return null
            return (
                <div className="flex items-center justify-between gap-3">
                    <span className="truncate">
                        {it.displayName} · {it.status}
                        {it.urgency === "HIGH" ? " · 紧急" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {timeAgo(it.createdAt)}
                    </span>
                </div>
            )
        }
        case "inventoryAlerts": {
            const it = source.items.find((x) => x.id === itemId)
            if (!it) return null
            const label =
                it.subtype === "RESTOCK_WAITING"
                    ? `缺货 · ${it.subscriberCount} 人等待`
                    : it.subtype === "OUT_OF_STOCK"
                      ? "缺货"
                      : `低库存（剩 ${it.unsoldCount}）`
            return <span className="truncate">{it.productName} · {label}</span>
        }
        case "manualPendingOrders": {
            const it = source.items.find((x) => x.id === itemId)
            if (!it) return null
            const display = it.variantName ?? it.productName
            return (
                <div className="flex items-center justify-between gap-3">
                    <Link
                        href={`/admin/orders/${it.id}`}
                        className="truncate hover:underline"
                    >
                        {display} · {formatCurrency(it.amount)}
                    </Link>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {timeAgo(it.createdAt)}
                        {it.dunCount > 0 ? ` · 催 ${it.dunCount}` : ""}
                    </span>
                </div>
            )
        }
    }
}

function DismissedPanel() {
    const { items, isLoading } = useDismissedNotifications()
    const restore = useRestoreNotifications()

    if (isLoading) return <LoadingCard />
    if (items.length === 0) {
        return <EmptyCard message="📭 暂无已读历史" />
    }

    const grouped = new Map<SourceKey, DismissedItem[]>()
    for (const it of items) {
        if (!grouped.has(it.sourceKey)) grouped.set(it.sourceKey, [])
        grouped.get(it.sourceKey)!.push(it)
    }

    return (
        <div className="space-y-4">
            {SOURCES.map((src) => {
                const group = grouped.get(src.key)
                if (!group || group.length === 0) return null
                const Icon = src.icon
                return (
                    <Card key={src.key} className="gap-0 py-0 overflow-hidden">
                        <CardHeader className="py-4">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Icon className="size-4 text-muted-foreground" />
                                {src.label}
                                <Badge variant="outline">{group.length}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <Separator />
                        <CardContent className="p-0">
                            <ul className="divide-y">
                                {group.map((it) => (
                                    <DismissedRow
                                        key={it.id}
                                        item={it}
                                        onRestore={() =>
                                            restore.mutate([
                                                { sourceKey: it.sourceKey, itemId: it.itemId },
                                            ])
                                        }
                                        restoring={restore.isPending}
                                    />
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}

function DismissedRow({
    item,
    onRestore,
    restoring,
}: {
    item: DismissedItem
    onRestore: () => void
    restoring: boolean
}) {
    return (
        <li className="group/dismiss-row flex items-center gap-3 px-6 py-3 text-sm transition-colors hover:bg-muted/40">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <Link
                        href={item.href}
                        className={
                            item.entityMissing
                                ? "truncate text-muted-foreground"
                                : "truncate hover:underline"
                        }
                    >
                        {item.title}
                    </Link>
                    {item.statusLabel && (
                        <Badge
                            variant={
                                item.statusTone === "success"
                                    ? "success"
                                    : item.statusTone === "destructive"
                                      ? "destructive"
                                      : item.statusTone === "warning"
                                        ? "warning"
                                        : "secondary"
                            }
                        >
                            {item.statusLabel}
                        </Badge>
                    )}
                    {item.entityMissing && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <AlertCircle className="size-3" />
                            已清理
                        </span>
                    )}
                </div>
                {item.subtitle && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</div>
                )}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                已读 {timeAgo(item.dismissedAt)}
            </span>
            <Button
                variant="ghost"
                size="sm"
                className="shrink-0 opacity-0 transition-opacity group-hover/dismiss-row:opacity-100 focus-visible:opacity-100"
                onClick={onRestore}
                disabled={restoring}
            >
                {restoring ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                ) : (
                    <RotateCcw className="mr-1 size-3" />
                )}
                恢复
            </Button>
        </li>
    )
}

function LoadingCard() {
    return (
        <Card className="gap-0 py-0">
            <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                加载中...
            </CardContent>
        </Card>
    )
}

function EmptyCard({ message }: { message: string }) {
    return (
        <Card className="gap-0 py-0">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {message}
            </CardContent>
        </Card>
    )
}
