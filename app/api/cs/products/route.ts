import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/cs/products
 * Public read-only endpoint for Hermes customer service agent.
 * Returns all active products with name, price, summary, stock and tags.
 */
export async function GET() {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      summary: true,
      price: true,
      productType: true,
      inventoryTracked: true,
      tags: { select: { name: true } },
      _count: {
        select: {
          cards: { where: { status: "UNSOLD" } },
          // MANUAL 商品库存在 ProductVariant 上，不写 cards 表。
          // tracked: 按 active+stockQuantity>0 判断；untracked: 仅看 isActive。
          // 这里取「active + 有库存」满足 tracked 场景；untracked 场景用单独
          // 的 active-only 聚合（见下）。
          variants: { where: { isActive: true, stockQuantity: { gt: 0 } } },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  })

  // Untracked MANUAL: "in stock" depends only on having any active variant,
  // independent of stockQuantity. Aggregate active-only variant counts for
  // those products in a single follow-up query.
  const untrackedManualIds = products
    .filter((p) => p.productType === "MANUAL" && p.inventoryTracked !== true)
    .map((p) => p.id)
  const untrackedActiveCounts = untrackedManualIds.length > 0
    ? await prisma.productVariant.groupBy({
        by: ["productId"],
        where: { productId: { in: untrackedManualIds }, isActive: true },
        _count: { id: true },
      })
    : []
  const untrackedActiveById = new Map(
    untrackedActiveCounts.map((r) => [r.productId, r._count.id]),
  )

  const data = products.map((p) => {
    const isManual = p.productType === "MANUAL"
    const inStock =
      p.productType === "AUTO_FETCH" ||
      p._count.cards > 0 ||
      (isManual && p.inventoryTracked === true && p._count.variants > 0) ||
      (isManual &&
        p.inventoryTracked !== true &&
        (untrackedActiveById.get(p.id) ?? 0) > 0)
    return {
      name: p.name,
      summary: p.summary ?? null,
      price: Number(p.price),
      productType: p.productType,
      tags: p.tags.map((t) => t.name),
      inStock,
    }
  })

  return NextResponse.json({ data })
}

export const runtime = "nodejs"
