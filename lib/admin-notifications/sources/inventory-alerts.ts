import { Package } from "lucide-react"
import type { NotificationSource, InventoryAlertItem } from "@/lib/admin-notifications"
import { resolveInventorySubtype, type InventorySubtype } from "@/lib/inventory"

const INVENTORY_PRODUCT_WHERE = {
  productType: "NORMAL" as const,
  status: "ACTIVE" as const,
}

const SUBTYPE_RANK: Record<InventorySubtype, number> = {
  RESTOCK_WAITING: 3,
  OUT_OF_STOCK: 2,
  LOW_STOCK: 1,
}

export const inventoryAlertsSource: NotificationSource<"inventoryAlerts"> = {
  key: "inventoryAlerts",
  label: "库存预警",
  icon: Package,
  menuHref: "/admin/products",
  viewAllHref: "/admin/products?notice=inventory",
  async fetch(prisma) {
    const [products, unsoldRows, subRows] = await Promise.all([
      prisma.product.findMany({
        where: INVENTORY_PRODUCT_WHERE,
        select: { id: true, name: true },
      }),
      prisma.card.groupBy({
        by: ["productId"],
        where: { status: "UNSOLD", product: INVENTORY_PRODUCT_WHERE },
        _count: { id: true },
      }),
      prisma.restockSubscription.groupBy({
        by: ["productId"],
        where: { status: "PENDING", product: INVENTORY_PRODUCT_WHERE },
        _count: { id: true },
      }),
    ])

    const unsoldMap = new Map(unsoldRows.map((r) => [r.productId, r._count.id]))
    const subMap = new Map(subRows.map((r) => [r.productId, r._count.id]))

    const items: InventoryAlertItem[] = []
    const breakdown = { outOfStock: 0, lowStock: 0, restockWaiting: 0 }

    for (const p of products) {
      const unsold = unsoldMap.get(p.id) ?? 0
      const subscribers = subMap.get(p.id) ?? 0
      const subtype = resolveInventorySubtype(unsold, subscribers)
      if (!subtype) continue

      items.push({
        productId: p.id,
        productName: p.name,
        unsoldCount: unsold,
        subscriberCount: subscribers,
        subtype,
      })

      if (subtype === "RESTOCK_WAITING") {
        breakdown.outOfStock += 1
        breakdown.restockWaiting += 1
      } else if (subtype === "OUT_OF_STOCK") {
        breakdown.outOfStock += 1
      } else {
        breakdown.lowStock += 1
      }
    }

    items.sort((a, b) => {
      const byRank = SUBTYPE_RANK[b.subtype] - SUBTYPE_RANK[a.subtype]
      if (byRank !== 0) return byRank
      if (b.subscriberCount !== a.subscriberCount) return b.subscriberCount - a.subscriberCount
      return a.unsoldCount - b.unsoldCount
    })

    return {
      count: items.length,
      breakdown,
      items: items.slice(0, 3),
    }
  },
}
