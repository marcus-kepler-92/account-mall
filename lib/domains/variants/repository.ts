// lib/domains/variants/repository.ts
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

type Tx = Prisma.TransactionClient | typeof prisma

export function findVariantsByProduct(productId: string, tx: Tx = prisma) {
  return tx.productVariant.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })
}

export function findVariantById(id: string, tx: Tx = prisma) {
  return tx.productVariant.findUnique({ where: { id } })
}

export function countActiveVariants(productId: string, tx: Tx = prisma) {
  return tx.productVariant.count({ where: { productId, isActive: true } })
}

export function countOrdersForVariant(variantId: string, tx: Tx = prisma) {
  return tx.order.count({ where: { variantId } })
}

export function createVariant(
  productId: string,
  data: { name: string; price: number; unitCost?: number | null; stockQuantity: number; sortOrder?: number; isActive?: boolean },
  tx: Tx = prisma,
) {
  return tx.productVariant.create({
    data: {
      productId,
      name: data.name,
      price: data.price,
      unitCost: data.unitCost ?? null,
      stockQuantity: data.stockQuantity,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    },
  })
}

export function updateVariant(id: string, data: Partial<{
  name: string; price: number; unitCost: number | null; stockQuantity: number; sortOrder: number; isActive: boolean
}>, tx: Tx = prisma) {
  return tx.productVariant.update({ where: { id }, data })
}

export function deleteVariant(id: string, tx: Tx = prisma) {
  return tx.productVariant.delete({ where: { id } })
}

/**
 * Atomic decrement: returns count=1 on success, 0 when stock insufficient.
 * Caller treats 0 as "sold out" and rolls back the surrounding transaction.
 */
export function decrementVariantStock(variantId: string, tx: Tx) {
  return tx.productVariant.updateMany({
    where: { id: variantId, stockQuantity: { gte: 1 } },
    data: { stockQuantity: { decrement: 1 } },
  })
}

export function incrementVariantStock(variantId: string, by = 1, tx: Tx = prisma) {
  return tx.productVariant.update({
    where: { id: variantId },
    data: { stockQuantity: { increment: by } },
  })
}
