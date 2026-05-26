// lib/domains/cards/service.ts
import {
  findCardById,
  findCardsByProduct,
  countCardsByProductStatus,
  countUnsoldCards,
  findCardsByProductForExport,
  createManyCards,
  updateCardStatus,
  updateCardStatusBatch,
  deleteCardById,
  deleteCardsBatch,
  findCardsById,
} from "./repository"
import type { CardStatus, CardRow, CardStats, BulkImportResult, BatchActionResult } from "./types"
import {
  CardNotFoundError,
  CardStatusTransitionError,
  AutoFetchProductError,
} from "./types"
import type { BulkImportCardsInput, PatchCardStatusInput, BatchCardActionInput } from "./validators"
import { notifyRestockSubscribers } from "@/lib/restock-notify"

// ── Admin card management ─────────────────────────────────────────────────────

export async function getCardsByProduct(
  productId: string,
  status?: CardStatus | null,
): Promise<{ cards: CardRow[]; stats: CardStats }> {
  const [cards, counts] = await Promise.all([
    findCardsByProduct(productId, status),
    countCardsByProductStatus(productId),
  ])

  const stats: CardStats = {
    UNSOLD: counts.find((c) => c.status === "UNSOLD")?._count.id ?? 0,
    RESERVED: counts.find((c) => c.status === "RESERVED")?._count.id ?? 0,
    SOLD: counts.find((c) => c.status === "SOLD")?._count.id ?? 0,
    DISABLED: counts.find((c) => c.status === "DISABLED")?._count.id ?? 0,
  }

  const serialized: CardRow[] = cards.map((c) => ({
    id: c.id,
    content: c.content,
    status: c.status as CardStatus,
    orderNo: c.order?.orderNo ?? null,
    createdAt: c.createdAt.toISOString(),
  }))

  return { cards: serialized, stats }
}

export async function exportCards(
  productId: string,
  status?: CardStatus | null,
): Promise<string[]> {
  const cards = await findCardsByProductForExport(productId, status)
  return cards.map((c) => c.content)
}

export async function bulkImportCards(
  productId: string,
  product: { id: string; name: string; slug: string; price: number; productType: string },
  input: BulkImportCardsInput,
): Promise<BulkImportResult> {
  if (product.productType === "AUTO_FETCH") {
    throw new AutoFetchProductError()
  }

  const contents = [...new Set(input.contents.map((c) => c.trim()).filter(Boolean))]
  if (contents.length === 0) throw new Error("No valid card contents to import")

  const oldUnsoldCount = await countUnsoldCards(productId)
  const { count } = await createManyCards(productId, contents, input.unitCost)

  if (oldUnsoldCount === 0 && count > 0) {
    notifyRestockSubscribers({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: Number(product.price),
      productType: product.productType,
    }).catch((err) => {
      console.error("[restock-notify] Failed to send restock emails", { productId, error: err })
    })
  }

  return { imported: count, total: contents.length }
}

export async function patchCardStatus(
  cardId: string,
  input: PatchCardStatusInput,
): Promise<{ status: CardStatus }> {
  const card = await findCardById(cardId)
  if (!card) throw new CardNotFoundError(cardId)

  const { status: targetStatus } = input

  if (targetStatus === "DISABLED" && card.status !== "UNSOLD") {
    throw new CardStatusTransitionError("Only unsold cards can be disabled")
  }
  if (targetStatus === "UNSOLD" && card.status !== "DISABLED") {
    throw new CardStatusTransitionError("Only disabled cards can be re-enabled")
  }

  await updateCardStatus(cardId, targetStatus)
  return { status: targetStatus }
}

export async function deleteCard(cardId: string): Promise<void> {
  const card = await findCardById(cardId)
  if (!card) throw new CardNotFoundError(cardId)
  if (card.status !== "UNSOLD") {
    throw new CardStatusTransitionError("Only unsold cards can be deleted")
  }
  await deleteCardById(cardId)
}

export async function batchCardAction(
  input: BatchCardActionInput,
): Promise<BatchActionResult> {
  const { action, cardIds } = input

  const cards = await findCardsById(cardIds)
  const cardMap = new Map(cards.map((c) => [c.id, c.status]))

  const idsToProcess: string[] = []
  let skipped = 0

  for (const id of cardIds) {
    const status = cardMap.get(id)
    if (!status) {
      skipped++
      continue
    }
    if (action === "DELETE" && status === "UNSOLD") idsToProcess.push(id)
    else if (action === "DISABLE" && status === "UNSOLD") idsToProcess.push(id)
    else if (action === "ENABLE" && status === "DISABLED") idsToProcess.push(id)
    else skipped++
  }

  if (idsToProcess.length === 0) return { success: 0, skipped }

  let successCount = 0
  if (action === "DELETE") {
    const result = await deleteCardsBatch(idsToProcess)
    successCount = result.count
  } else if (action === "DISABLE") {
    const result = await updateCardStatusBatch(idsToProcess, "DISABLED")
    successCount = result.count
  } else {
    const result = await updateCardStatusBatch(idsToProcess, "UNSOLD")
    successCount = result.count
  }

  return { success: successCount, skipped }
}
