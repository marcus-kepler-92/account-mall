// lib/domains/cards/repository.ts
import { prisma } from "@/lib/prisma"
import type { PrismaClient } from "@prisma/client"
import type { CardStatus } from "./types"

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

// ── Queries ──────────────────────────────────────────────────────────────────

export async function findCardById(id: string, tx?: Tx) {
  return (tx ?? prisma).card.findUnique({ where: { id } })
}

export async function findCardsByProduct(
  productId: string,
  status?: CardStatus | null,
  tx?: Tx,
) {
  return (tx ?? prisma).card.findMany({
    where: { productId, ...(status ? { status } : {}) },
    include: { order: { select: { orderNo: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  })
}

export async function countCardsByProductStatus(productId: string, tx?: Tx) {
  return (tx ?? prisma).card.groupBy({
    by: ["status"],
    where: { productId },
    _count: { id: true },
  })
}

export async function countUnsoldCards(productId: string, tx?: Tx) {
  return (tx ?? prisma).card.count({ where: { productId, status: "UNSOLD" } })
}

export async function findCardsByProductForExport(
  productId: string,
  status?: CardStatus | null,
  tx?: Tx,
) {
  return (tx ?? prisma).card.findMany({
    where: { productId, ...(status ? { status } : {}) },
    select: { content: true },
    orderBy: { createdAt: "desc" },
  })
}

export async function findCardsById(
  ids: string[],
  tx?: Tx,
) {
  return (tx ?? prisma).card.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true },
  })
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function createManyCards(
  productId: string,
  contents: string[],
  unitCost: number | null,
  tx?: Tx,
) {
  return (tx ?? prisma).card.createMany({
    data: contents.map((content) => ({
      productId,
      content,
      status: "UNSOLD" as const,
      unitCost,
    })),
  })
}

export async function updateCardStatus(id: string, status: CardStatus, tx?: Tx) {
  return (tx ?? prisma).card.update({ where: { id }, data: { status } })
}

export async function updateCardStatusBatch(
  ids: string[],
  status: CardStatus,
  tx?: Tx,
) {
  return (tx ?? prisma).card.updateMany({
    where: { id: { in: ids } },
    data: { status },
  })
}

export async function deleteCardById(id: string, tx?: Tx) {
  return (tx ?? prisma).card.delete({ where: { id } })
}

export async function deleteCardsBatch(ids: string[], tx?: Tx) {
  return (tx ?? prisma).card.deleteMany({ where: { id: { in: ids } } })
}

// ── Cross-domain: called by orders domain (tx-aware) ─────────────────────────

export async function reserveCardsForOrder(
  productId: string,
  quantity: number,
  orderId: string,
  tx: Tx,
) {
  const cards = await tx.card.findMany({
    where: { productId, status: "UNSOLD" },
    take: quantity,
    orderBy: { createdAt: "asc" },
  })
  if (cards.length < quantity) return null
  await tx.card.updateMany({
    where: { id: { in: cards.map((c) => c.id) } },
    data: { status: "RESERVED", orderId },
  })
  return cards
}

export async function releaseReservedCards(orderId: string, tx: Tx) {
  return tx.card.updateMany({
    where: { orderId, status: "RESERVED" },
    data: { status: "UNSOLD", orderId: null },
  })
}

export async function deleteAutoFetchCards(orderId: string, tx: Tx) {
  return tx.card.deleteMany({ where: { orderId, status: "RESERVED" } })
}

export async function markCardsSold(orderId: string, tx: Tx) {
  return tx.card.updateMany({
    where: { orderId, status: "RESERVED" },
    data: { status: "SOLD" },
  })
}
