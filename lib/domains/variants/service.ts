// lib/domains/variants/service.ts
import { prisma } from "@/lib/prisma"
import {
  findVariantsByProduct,
  findVariantById,
  countActiveVariants,
  countOrdersForVariant,
  createVariant as repoCreate,
  updateVariant as repoUpdate,
  deleteVariant as repoDelete,
} from "./repository"
import type { VariantRow } from "./types"
import { VariantNotFoundError, VariantHasOrdersError, NotManualProductError } from "./types"
import type { VariantCreateInput, VariantUpdateInput } from "./validators"

function toRow(v: Awaited<ReturnType<typeof findVariantById>>): VariantRow {
  if (!v) throw new Error("toRow: null variant")
  return {
    id: v.id,
    name: v.name,
    price: v.price.toString(),
    unitCost: v.unitCost?.toString() ?? null,
    stockQuantity: v.stockQuantity,
    sortOrder: v.sortOrder,
    isActive: v.isActive,
    createdAt: v.createdAt.toISOString(),
  }
}

export async function listVariants(productId: string): Promise<VariantRow[]> {
  const rows = await findVariantsByProduct(productId)
  return rows.map(toRow)
}

async function assertManualProduct(productId: string) {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { productType: true } })
  if (!p || p.productType !== "MANUAL") throw new NotManualProductError()
}

export async function createVariantForProduct(productId: string, input: VariantCreateInput): Promise<VariantRow> {
  await assertManualProduct(productId)
  const created = await repoCreate(productId, input)
  return toRow(created)
}

export async function updateVariantById(variantId: string, input: VariantUpdateInput): Promise<VariantRow> {
  const existing = await findVariantById(variantId)
  if (!existing) throw new VariantNotFoundError(variantId)
  const updated = await repoUpdate(variantId, input)
  // If the product had its last active variant deactivated, auto-deactivate product
  if (input.isActive === false) {
    await deactivateProductIfNoActiveVariants(existing.productId)
  }
  return toRow(updated)
}

export async function deleteVariantById(variantId: string): Promise<void> {
  const existing = await findVariantById(variantId)
  if (!existing) throw new VariantNotFoundError(variantId)
  const orderCount = await countOrdersForVariant(variantId)
  if (orderCount > 0) throw new VariantHasOrdersError(variantId)
  await repoDelete(variantId)
  await deactivateProductIfNoActiveVariants(existing.productId)
}

async function deactivateProductIfNoActiveVariants(productId: string): Promise<void> {
  const active = await countActiveVariants(productId)
  if (active === 0) {
    await prisma.product.update({ where: { id: productId }, data: { status: "INACTIVE" } })
  }
}

export async function assertProductHasActiveVariant(productId: string): Promise<void> {
  const active = await countActiveVariants(productId)
  if (active === 0) {
    throw new Error("MANUAL product must have at least one active variant before going ACTIVE")
  }
}
