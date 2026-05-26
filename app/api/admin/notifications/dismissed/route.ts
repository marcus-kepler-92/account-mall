import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import type { SourceKey } from "@/lib/admin-notifications"

/**
 * Returns the admin's dismissed notification history. Each row carries
 * the dismissal metadata + a snapshot-from-current-state of the
 * underlying entity (order / withdrawal / lead / product), so the
 * "已读" tab can render meaningful titles without storing snapshots in
 * the dismissal table.
 *
 * Status semantics: the entity's *current* state, not state-at-dismissal-
 * time. This is intentional — the user can see "I dismissed this when it
 * was 待发货, now it's 已完成". Acceptable drift; storing a snapshot
 * would require a schema migration with empty history.
 *
 * If the underlying entity has been deleted (rare — most are kept), the
 * dismissal row still surfaces with `entityMissing: true`. The user can
 * restore (which won't bring the entity back) or live with the orphan.
 */

export type DismissedItem = {
    /** Dismissal record id (for restore). */
    id: string
    sourceKey: SourceKey
    /** Entity id (Order.id / Withdrawal.id / etc.). */
    itemId: string
    fingerprint: string
    title: string
    /** Optional secondary line — distributor name / variant / etc. */
    subtitle?: string
    /** Current status label (entity-dependent). */
    statusLabel?: string
    /** "tone" of the status badge. */
    statusTone?: "success" | "warning" | "destructive" | "secondary"
    /** Link to inspect the underlying entity (admin page). */
    href: string
    dismissedAt: string
    /** True if entity has been deleted upstream — no current state available. */
    entityMissing?: boolean
}

const STATUS_TONE_BY_ORDER_STATUS: Record<
    string,
    "success" | "warning" | "destructive" | "secondary"
> = {
    PENDING: "warning",
    AWAITING_FULFILLMENT: "warning",
    PROCESSING: "warning",
    COMPLETED: "success",
    CLOSED: "secondary",
}

const ORDER_STATUS_LABEL: Record<string, string> = {
    PENDING: "待付款",
    AWAITING_FULFILLMENT: "待发货",
    PROCESSING: "处理中",
    COMPLETED: "已完成",
    CLOSED: "已关闭",
}

const WITHDRAWAL_STATUS_LABEL: Record<string, string> = {
    PENDING: "待审核",
    APPROVED: "已通过",
    REJECTED: "已驳回",
    PAID: "已打款",
}

const WITHDRAWAL_STATUS_TONE: Record<
    string,
    "success" | "warning" | "destructive" | "secondary"
> = {
    PENDING: "warning",
    APPROVED: "secondary",
    REJECTED: "destructive",
    PAID: "success",
}

const AGENT_LEAD_STATUS_LABEL: Record<string, string> = {
    NEW: "新建",
    CONTACTED: "已联系",
    CLOSED: "已关闭",
}

const AGENT_LEAD_STATUS_TONE: Record<
    string,
    "success" | "warning" | "destructive" | "secondary"
> = {
    NEW: "warning",
    CONTACTED: "secondary",
    CLOSED: "success",
}

export async function GET() {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const adminId = session.user.id

    const dismissals = await prisma.adminNotificationDismissal.findMany({
        where: { adminId },
        orderBy: { dismissedAt: "desc" },
        take: 200,
    })

    // Partition by source for batched lookups
    const idsBySource: Record<SourceKey, string[]> = {
        withdrawals: [],
        agentLeads: [],
        inventoryAlerts: [],
        manualPendingOrders: [],
    }
    for (const d of dismissals) {
        const key = d.sourceKey as SourceKey
        if (idsBySource[key]) idsBySource[key].push(d.itemId)
    }

    const [withdrawals, leads, products, orders] = await Promise.all([
        idsBySource.withdrawals.length
            ? prisma.withdrawal.findMany({
                  where: { id: { in: idsBySource.withdrawals } },
                  select: {
                      id: true,
                      amount: true,
                      status: true,
                      distributor: { select: { name: true, email: true } },
                  },
              })
            : Promise.resolve([]),
        idsBySource.agentLeads.length
            ? prisma.agentLead.findMany({
                  where: { id: { in: idsBySource.agentLeads } },
                  select: {
                      id: true,
                      wechatId: true,
                      status: true,
                      urgency: true,
                  },
              })
            : Promise.resolve([]),
        idsBySource.inventoryAlerts.length
            ? prisma.product.findMany({
                  where: { id: { in: idsBySource.inventoryAlerts } },
                  select: { id: true, name: true, status: true },
              })
            : Promise.resolve([]),
        idsBySource.manualPendingOrders.length
            ? prisma.order.findMany({
                  where: { id: { in: idsBySource.manualPendingOrders } },
                  select: {
                      id: true,
                      orderNo: true,
                      status: true,
                      amount: true,
                      productNameSnapshot: true,
                      variantNameSnapshot: true,
                  },
              })
            : Promise.resolve([]),
    ])

    const withdrawalsById = new Map(withdrawals.map((w) => [w.id, w]))
    const leadsById = new Map(leads.map((l) => [l.id, l]))
    const productsById = new Map(products.map((p) => [p.id, p]))
    const ordersById = new Map(orders.map((o) => [o.id, o]))

    const items: DismissedItem[] = dismissals.map((d) => {
        const sourceKey = d.sourceKey as SourceKey
        const base = {
            id: d.id,
            sourceKey,
            itemId: d.itemId,
            fingerprint: d.fingerprint,
            dismissedAt: d.dismissedAt.toISOString(),
        }
        switch (sourceKey) {
            case "withdrawals": {
                const w = withdrawalsById.get(d.itemId)
                if (!w) {
                    return {
                        ...base,
                        title: `提现 · ${d.itemId.slice(0, 8)}`,
                        href: "/admin/withdrawals",
                        entityMissing: true,
                    }
                }
                return {
                    ...base,
                    title: w.distributor.name || w.distributor.email || "未知分销员",
                    subtitle: `¥${Number(w.amount).toFixed(2)}`,
                    statusLabel: WITHDRAWAL_STATUS_LABEL[w.status] ?? w.status,
                    statusTone: WITHDRAWAL_STATUS_TONE[w.status] ?? "secondary",
                    href: `/admin/withdrawals?status=${w.status}`,
                }
            }
            case "agentLeads": {
                const l = leadsById.get(d.itemId)
                if (!l) {
                    return {
                        ...base,
                        title: `线索 · ${d.itemId.slice(0, 8)}`,
                        href: "/admin/agent/leads",
                        entityMissing: true,
                    }
                }
                return {
                    ...base,
                    title: l.wechatId || `线索 · ${l.id.slice(0, 8)}`,
                    subtitle: l.urgency === "HIGH" ? "紧急" : undefined,
                    statusLabel: AGENT_LEAD_STATUS_LABEL[l.status] ?? l.status,
                    statusTone: AGENT_LEAD_STATUS_TONE[l.status] ?? "secondary",
                    href: `/admin/agent/leads`,
                }
            }
            case "inventoryAlerts": {
                const p = productsById.get(d.itemId)
                if (!p) {
                    return {
                        ...base,
                        title: `商品 · ${d.itemId.slice(0, 8)}`,
                        href: "/admin/products",
                        entityMissing: true,
                    }
                }
                return {
                    ...base,
                    title: p.name,
                    statusLabel: p.status === "ACTIVE" ? "在售" : "已下架",
                    statusTone: p.status === "ACTIVE" ? "success" : "secondary",
                    href: `/admin/products`,
                }
            }
            case "manualPendingOrders": {
                const o = ordersById.get(d.itemId)
                if (!o) {
                    return {
                        ...base,
                        title: `订单 · ${d.itemId.slice(0, 8)}`,
                        href: "/admin/fulfillment",
                        entityMissing: true,
                    }
                }
                return {
                    ...base,
                    title: o.productNameSnapshot ?? "订单",
                    subtitle: o.variantNameSnapshot ?? undefined,
                    statusLabel: ORDER_STATUS_LABEL[o.status] ?? o.status,
                    statusTone: STATUS_TONE_BY_ORDER_STATUS[o.status] ?? "secondary",
                    href: `/admin/orders/${o.id}`,
                }
            }
        }
    })

    return NextResponse.json({ items })
}

export const runtime = "nodejs"
