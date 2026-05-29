import { PackageCheck } from "lucide-react"
import { OrderStatus, ProductType, type Prisma } from "@prisma/client"
import type { NotificationSource } from "@/lib/admin-notifications"
import { SOURCE_ITEM_TAKE } from "@/lib/admin-notifications/constants"

export const manualPendingOrdersSource: NotificationSource<"manualPendingOrders"> = {
  key: "manualPendingOrders",
  label: "待发货订单",
  icon: PackageCheck,
  // Dedicated 人工发货 center handles MANUAL fulfillment exclusively; sidebar
  // badge and notification "view all" both land users in the in_progress filter
  // (default) so AWAITING_FULFILLMENT + PROCESSING rows surface immediately.
  menuHref: "/admin/fulfillment",
  viewAllHref: "/admin/fulfillment",
  async fetch(prisma) {
    const where: Prisma.OrderWhereInput = {
      status: { in: [OrderStatus.AWAITING_FULFILLMENT, OrderStatus.PROCESSING] },
      product: { is: { productType: ProductType.MANUAL } },
    }
    const [count, rows] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        take: SOURCE_ITEM_TAKE,
        // Surface dunned orders first (most-recently-dunned at the top), then
        // fall back to oldest-first so backlog naturally bubbles up.
        orderBy: [{ lastDunAt: { sort: "desc", nulls: "last" } }, { createdAt: "asc" }],
        select: {
          id: true,
          orderNo: true,
          amount: true,
          status: true,
          dunCount: true,
          createdAt: true,
          variantNameSnapshot: true,
          productNameSnapshot: true,
          product: { select: { name: true } },
        },
      }),
    ])
    return {
      count,
      items: rows.map((r) => ({
        id: r.id,
        // Fingerprint = dunCount so a dismissed entry re-surfaces whenever the
        // buyer dunns again. Status changes (AWAITING→PROCESSING) intentionally
        // don't bump the fingerprint — admin's own take action shouldn't spam
        // them. COMPLETED/CLOSED naturally drop out via the source's where
        // filter so they don't need fingerprint coverage.
        fingerprint: `v1:${r.dunCount}`,
        orderNo: r.orderNo,
        productName: r.productNameSnapshot ?? r.product.name,
        variantName: r.variantNameSnapshot,
        amount: Number(r.amount),
        status: r.status as "AWAITING_FULFILLMENT" | "PROCESSING",
        dunCount: r.dunCount,
        createdAt: r.createdAt.toISOString(),
      })),
    }
  },
}
