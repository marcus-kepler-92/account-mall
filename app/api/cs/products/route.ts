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
      name: true,
      summary: true,
      price: true,
      productType: true,
      tags: { select: { name: true } },
      _count: { select: { cards: { where: { status: "UNSOLD" } } } },
    },
    orderBy: { sortOrder: "asc" },
  })

  const data = products.map((p) => ({
    name: p.name,
    summary: p.summary ?? null,
    price: Number(p.price),
    productType: p.productType,
    tags: p.tags.map((t) => t.name),
    inStock: p.productType === "AUTO_FETCH" || p._count.cards > 0,
  }))

  return NextResponse.json({ data })
}

export const runtime = "nodejs"
