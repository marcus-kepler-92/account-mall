# Cards Domain Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all card-related business logic into `lib/domains/cards/` following the FSD functional domain module architecture, making the cards domain the reference template for all subsequent domain migrations.

**Architecture:** Create a self-contained domain module (types → validators → repository → service → index). API route handlers are slimmed to ≤20 lines (auth + validate + call service + return). Business rules move to service, all Prisma calls move to repository. Existing route-level tests continue to pass via the same prisma mock.

**Tech Stack:** TypeScript, Prisma 6, Zod, Jest, Next.js 16 App Router

---

## File Map

**Create:**
- `lib/domains/cards/types.ts` — domain types + error classes
- `lib/domains/cards/validators.ts` — Zod schemas (migrated from `lib/validations/card.ts`)
- `lib/domains/cards/repository.ts` — all Prisma card operations
- `lib/domains/cards/service.ts` — all business logic
- `lib/domains/cards/index.ts` — public API whitelist
- `lib/domains/cards/__tests__/service.test.ts` — service unit tests

**Modify:**
- `app/api/cards/[cardId]/route.ts` — slim to 4-step template
- `app/api/cards/batch/route.ts` — slim to 4-step template
- `app/api/products/[productId]/cards/route.ts` — slim to 4-step template
- `app/api/products/[productId]/cards/export/route.ts` — slim to 4-step template
- `lib/validations/card.ts` — re-export from domain (backwards compat)

---

## Task 1: Create directory and types.ts

**Files:**
- Create: `lib/domains/cards/types.ts`

- [ ] **Step 1: Create the directory and types file**

```typescript
// lib/domains/cards/types.ts
import type { Prisma } from "@prisma/client"

export type Card = Prisma.CardGetPayload<Record<string, never>>
export type CardStatus = "UNSOLD" | "RESERVED" | "SOLD" | "DISABLED"

export type CardRow = {
  id: string
  content: string
  status: CardStatus
  orderNo: string | null
  createdAt: string
}

export type CardStats = {
  UNSOLD: number
  RESERVED: number
  SOLD: number
  DISABLED: number
}

export type BulkImportResult = { imported: number; total: number }
export type BatchActionResult = { success: number; skipped: number }

// Domain errors
export class CardNotFoundError extends Error {
  constructor(id: string) {
    super(`Card ${id} not found`)
    this.name = "CardNotFoundError"
  }
}

export class CardStatusTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CardStatusTransitionError"
  }
}

export class AutoFetchProductError extends Error {
  constructor() {
    super("AUTO_FETCH products do not support manual card import")
    this.name = "AutoFetchProductError"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/domains/cards/types.ts
git commit -m "feat(cards-domain): add types and error classes"
```

---

## Task 2: Create validators.ts

**Files:**
- Create: `lib/domains/cards/validators.ts`

- [ ] **Step 1: Create validators file (migrate schemas from lib/validations/card.ts)**

```typescript
// lib/domains/cards/validators.ts
import * as z from "zod"

const MAX_BULK_IMPORT = 500

export const bulkImportCardsSchema = z.object({
  contents: z
    .array(z.string().min(1, "Card content cannot be empty"))
    .min(1, "At least one card is required")
    .max(MAX_BULK_IMPORT, `Maximum ${MAX_BULK_IMPORT} cards per import`),
})

export type BulkImportCardsInput = z.infer<typeof bulkImportCardsSchema>

export const patchCardStatusSchema = z.object({
  status: z.enum(["DISABLED", "UNSOLD"]),
})

export type PatchCardStatusInput = z.infer<typeof patchCardStatusSchema>

export const batchCardActionSchema = z.object({
  action: z.enum(["DELETE", "DISABLE", "ENABLE"]),
  cardIds: z
    .array(z.string().min(1))
    .min(1, "At least one card ID is required")
    .max(100, "Maximum 100 cards per batch operation"),
})

export type BatchCardActionInput = z.infer<typeof batchCardActionSchema>

export const cardStatusFilterSchema = z
  .enum(["UNSOLD", "RESERVED", "SOLD", "DISABLED"])
  .nullable()
  .optional()
```

- [ ] **Step 2: Commit**

```bash
git add lib/domains/cards/validators.ts
git commit -m "feat(cards-domain): add validators (migrated from lib/validations/card)"
```

---

## Task 3: Create repository.ts

**Files:**
- Create: `lib/domains/cards/repository.ts`

- [ ] **Step 1: Create repository file**

```typescript
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
  tx?: Tx,
) {
  return (tx ?? prisma).card.createMany({
    data: contents.map((content) => ({
      productId,
      content,
      status: "UNSOLD" as const,
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/domains/cards/repository.ts
git commit -m "feat(cards-domain): add repository with all Prisma card operations"
```

---

## Task 4: Write service unit tests (TDD — failing first)

**Files:**
- Create: `lib/domains/cards/__tests__/service.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// lib/domains/cards/__tests__/service.test.ts
jest.mock("../repository")
jest.mock("@/lib/restock-notify", () => ({
  notifyRestockSubscribers: jest.fn().mockResolvedValue(undefined),
}))

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
} from "../repository"
import { notifyRestockSubscribers } from "@/lib/restock-notify"

import {
  patchCardStatus,
  deleteCard,
  batchCardAction,
  bulkImportCards,
  exportCards,
  getCardsByProduct,
} from "../service"
import {
  CardNotFoundError,
  CardStatusTransitionError,
  AutoFetchProductError,
} from "../types"

const mockCard = {
  id: "card_1",
  content: "test-code",
  status: "UNSOLD" as const,
  productId: "prod_1",
  orderId: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
}

beforeEach(() => jest.clearAllMocks())

// ── patchCardStatus ───────────────────────────────────────────────────────────

describe("patchCardStatus", () => {
  it("throws CardNotFoundError when card does not exist", async () => {
    ;(findCardById as jest.Mock).mockResolvedValue(null)
    await expect(patchCardStatus("card_1", { status: "DISABLED" })).rejects.toThrow(
      CardNotFoundError,
    )
  })

  it("throws CardStatusTransitionError when disabling a non-UNSOLD card", async () => {
    ;(findCardById as jest.Mock).mockResolvedValue({ ...mockCard, status: "SOLD" })
    await expect(patchCardStatus("card_1", { status: "DISABLED" })).rejects.toThrow(
      CardStatusTransitionError,
    )
  })

  it("throws CardStatusTransitionError when enabling a non-DISABLED card", async () => {
    ;(findCardById as jest.Mock).mockResolvedValue({ ...mockCard, status: "UNSOLD" })
    await expect(patchCardStatus("card_1", { status: "UNSOLD" })).rejects.toThrow(
      CardStatusTransitionError,
    )
  })

  it("updates and returns new status when disabling an UNSOLD card", async () => {
    ;(findCardById as jest.Mock).mockResolvedValue(mockCard)
    ;(updateCardStatus as jest.Mock).mockResolvedValue({ ...mockCard, status: "DISABLED" })
    const result = await patchCardStatus("card_1", { status: "DISABLED" })
    expect(updateCardStatus).toHaveBeenCalledWith("card_1", "DISABLED")
    expect(result).toEqual({ status: "DISABLED" })
  })

  it("updates and returns new status when enabling a DISABLED card", async () => {
    ;(findCardById as jest.Mock).mockResolvedValue({ ...mockCard, status: "DISABLED" })
    ;(updateCardStatus as jest.Mock).mockResolvedValue({ ...mockCard, status: "UNSOLD" })
    const result = await patchCardStatus("card_1", { status: "UNSOLD" })
    expect(updateCardStatus).toHaveBeenCalledWith("card_1", "UNSOLD")
    expect(result).toEqual({ status: "UNSOLD" })
  })
})

// ── deleteCard ────────────────────────────────────────────────────────────────

describe("deleteCard", () => {
  it("throws CardNotFoundError when card does not exist", async () => {
    ;(findCardById as jest.Mock).mockResolvedValue(null)
    await expect(deleteCard("card_1")).rejects.toThrow(CardNotFoundError)
  })

  it("throws CardStatusTransitionError when deleting a non-UNSOLD card", async () => {
    ;(findCardById as jest.Mock).mockResolvedValue({ ...mockCard, status: "SOLD" })
    await expect(deleteCard("card_1")).rejects.toThrow(CardStatusTransitionError)
  })

  it("deletes the card when it is UNSOLD", async () => {
    ;(findCardById as jest.Mock).mockResolvedValue(mockCard)
    ;(deleteCardById as jest.Mock).mockResolvedValue(mockCard)
    await deleteCard("card_1")
    expect(deleteCardById).toHaveBeenCalledWith("card_1")
  })
})

// ── batchCardAction ───────────────────────────────────────────────────────────

describe("batchCardAction", () => {
  it("skips cards not in the result set", async () => {
    ;(findCardsById as jest.Mock).mockResolvedValue([])
    const result = await batchCardAction({ action: "ENABLE", cardIds: ["card_1", "card_2"] })
    expect(result).toEqual({ success: 0, skipped: 2 })
  })

  it("skips SOLD cards when action is DISABLE", async () => {
    ;(findCardsById as jest.Mock).mockResolvedValue([{ id: "card_1", status: "SOLD" }])
    const result = await batchCardAction({ action: "DISABLE", cardIds: ["card_1"] })
    expect(result).toEqual({ success: 0, skipped: 1 })
  })

  it("disables UNSOLD cards and returns correct counts", async () => {
    ;(findCardsById as jest.Mock).mockResolvedValue([
      { id: "card_1", status: "UNSOLD" },
      { id: "card_2", status: "SOLD" },
    ])
    ;(updateCardStatusBatch as jest.Mock).mockResolvedValue({ count: 1 })
    const result = await batchCardAction({ action: "DISABLE", cardIds: ["card_1", "card_2"] })
    expect(updateCardStatusBatch).toHaveBeenCalledWith(["card_1"], "DISABLED")
    expect(result).toEqual({ success: 1, skipped: 1 })
  })

  it("enables DISABLED cards", async () => {
    ;(findCardsById as jest.Mock).mockResolvedValue([{ id: "card_1", status: "DISABLED" }])
    ;(updateCardStatusBatch as jest.Mock).mockResolvedValue({ count: 1 })
    await batchCardAction({ action: "ENABLE", cardIds: ["card_1"] })
    expect(updateCardStatusBatch).toHaveBeenCalledWith(["card_1"], "UNSOLD")
  })

  it("deletes UNSOLD cards", async () => {
    ;(findCardsById as jest.Mock).mockResolvedValue([{ id: "card_1", status: "UNSOLD" }])
    ;(deleteCardsBatch as jest.Mock).mockResolvedValue({ count: 1 })
    await batchCardAction({ action: "DELETE", cardIds: ["card_1"] })
    expect(deleteCardsBatch).toHaveBeenCalledWith(["card_1"])
  })
})

// ── bulkImportCards ───────────────────────────────────────────────────────────

describe("bulkImportCards", () => {
  const product = {
    id: "prod_1",
    name: "Test Product",
    slug: "test-product",
    price: 9.99,
    productType: "NORMAL",
  }

  it("throws AutoFetchProductError for AUTO_FETCH products", async () => {
    await expect(
      bulkImportCards("prod_1", { ...product, productType: "AUTO_FETCH" }, { contents: ["code1"] }),
    ).rejects.toThrow(AutoFetchProductError)
  })

  it("throws when all contents are empty after trimming", async () => {
    await expect(
      bulkImportCards("prod_1", product, { contents: ["  ", ""] }),
    ).rejects.toThrow("No valid card contents to import")
  })

  it("deduplicates contents before import", async () => {
    ;(countUnsoldCards as jest.Mock).mockResolvedValue(1)
    ;(createManyCards as jest.Mock).mockResolvedValue({ count: 1 })
    await bulkImportCards("prod_1", product, { contents: ["code1", "code1", "code1"] })
    expect(createManyCards).toHaveBeenCalledWith("prod_1", ["code1"])
  })

  it("triggers restock notify when stock goes from 0 to non-zero", async () => {
    ;(countUnsoldCards as jest.Mock).mockResolvedValue(0)
    ;(createManyCards as jest.Mock).mockResolvedValue({ count: 2 })
    await bulkImportCards("prod_1", product, { contents: ["code1", "code2"] })
    expect(notifyRestockSubscribers).toHaveBeenCalledWith({
      id: "prod_1",
      name: "Test Product",
      slug: "test-product",
      price: 9.99,
    })
  })

  it("does not trigger restock notify when stock was already non-zero", async () => {
    ;(countUnsoldCards as jest.Mock).mockResolvedValue(5)
    ;(createManyCards as jest.Mock).mockResolvedValue({ count: 2 })
    await bulkImportCards("prod_1", product, { contents: ["code1", "code2"] })
    expect(notifyRestockSubscribers).not.toHaveBeenCalled()
  })

  it("returns imported count and total", async () => {
    ;(countUnsoldCards as jest.Mock).mockResolvedValue(0)
    ;(createManyCards as jest.Mock).mockResolvedValue({ count: 2 })
    const result = await bulkImportCards("prod_1", product, { contents: ["code1", "code2"] })
    expect(result).toEqual({ imported: 2, total: 2 })
  })
})

// ── exportCards ───────────────────────────────────────────────────────────────

describe("exportCards", () => {
  it("returns array of content strings", async () => {
    ;(findCardsByProductForExport as jest.Mock).mockResolvedValue([
      { content: "code1" },
      { content: "code2" },
    ])
    const result = await exportCards("prod_1", "UNSOLD")
    expect(result).toEqual(["code1", "code2"])
    expect(findCardsByProductForExport).toHaveBeenCalledWith("prod_1", "UNSOLD")
  })
})

// ── getCardsByProduct ─────────────────────────────────────────────────────────

describe("getCardsByProduct", () => {
  it("returns serialized cards and stats", async () => {
    ;(findCardsByProduct as jest.Mock).mockResolvedValue([
      { ...mockCard, order: null },
    ])
    ;(countCardsByProductStatus as jest.Mock).mockResolvedValue([
      { status: "UNSOLD", _count: { id: 3 } },
    ])

    const result = await getCardsByProduct("prod_1")

    expect(result.stats).toEqual({ UNSOLD: 3, RESERVED: 0, SOLD: 0, DISABLED: 0 })
    expect(result.cards[0]).toMatchObject({
      id: "card_1",
      content: "test-code",
      status: "UNSOLD",
      orderNo: null,
    })
    expect(typeof result.cards[0].createdAt).toBe("string")
  })
})
```

- [ ] **Step 2: Run the tests to confirm they all fail (service.ts does not exist yet)**

```bash
npx jest lib/domains/cards/__tests__/service.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '../service'"

- [ ] **Step 3: Commit the failing tests**

```bash
git add lib/domains/cards/__tests__/service.test.ts
git commit -m "test(cards-domain): add failing service unit tests"
```

---

## Task 5: Implement service.ts

**Files:**
- Create: `lib/domains/cards/service.ts`

- [ ] **Step 1: Create service.ts**

```typescript
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
  const { count } = await createManyCards(productId, contents)

  if (oldUnsoldCount === 0 && count > 0) {
    notifyRestockSubscribers({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: Number(product.price),
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
```

- [ ] **Step 2: Run the service tests to confirm they all pass**

```bash
npx jest lib/domains/cards/__tests__/service.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/domains/cards/service.ts
git commit -m "feat(cards-domain): implement service layer (TDD green)"
```

---

## Task 6: Create index.ts

**Files:**
- Create: `lib/domains/cards/index.ts`

- [ ] **Step 1: Create the public API whitelist**

```typescript
// lib/domains/cards/index.ts

// Service functions — admin card management
export {
  getCardsByProduct,
  exportCards,
  bulkImportCards,
  patchCardStatus,
  deleteCard,
  batchCardAction,
} from "./service"

// Cross-domain repository functions — called by orders domain with tx
export {
  reserveCardsForOrder,
  releaseReservedCards,
  deleteAutoFetchCards,
  markCardsSold,
} from "./repository"

// Validators
export { bulkImportCardsSchema, patchCardStatusSchema, batchCardActionSchema } from "./validators"
export type { BulkImportCardsInput, PatchCardStatusInput, BatchCardActionInput } from "./validators"

// Types
export type { Card, CardStatus, CardRow, CardStats, BulkImportResult, BatchActionResult } from "./types"

// Domain errors
export { CardNotFoundError, CardStatusTransitionError, AutoFetchProductError } from "./types"
```

- [ ] **Step 2: Commit**

```bash
git add lib/domains/cards/index.ts
git commit -m "feat(cards-domain): add public index (API whitelist)"
```

---

## Task 7: Slim down app/api/cards/[cardId]/route.ts

**Files:**
- Modify: `app/api/cards/[cardId]/route.ts`

- [ ] **Step 1: Replace the route file content**

```typescript
// app/api/cards/[cardId]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound, badRequest, invalidJsonBody, validationError } from "@/lib/api-response"
import {
  patchCardStatusSchema,
  patchCardStatus,
  deleteCard,
  CardNotFoundError,
  CardStatusTransitionError,
} from "@/lib/domains/cards"

type RouteContext = { params: Promise<{ cardId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { cardId } = await context.params

  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }

  const parsed = patchCardStatusSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  try {
    const result = await patchCardStatus(cardId, parsed.data)
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof CardNotFoundError) return notFound("Card not found")
    if (e instanceof CardStatusTransitionError) return badRequest(e.message)
    throw e
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { cardId } = await context.params

  try {
    await deleteCard(cardId)
    return NextResponse.json({ message: "Card deleted" })
  } catch (e) {
    if (e instanceof CardNotFoundError) return notFound("Card not found")
    if (e instanceof CardStatusTransitionError) return badRequest(e.message)
    throw e
  }
}

export const runtime = "nodejs"
```

- [ ] **Step 2: Run the existing route tests to verify they still pass**

```bash
npx jest __tests__/api/cards-cardId.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/cards/\[cardId\]/route.ts
git commit -m "refactor(cards): slim route handler, delegate to domain service"
```

---

## Task 8: Slim down app/api/cards/batch/route.ts

**Files:**
- Modify: `app/api/cards/batch/route.ts`

- [ ] **Step 1: Replace the route file content**

```typescript
// app/api/cards/batch/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession, getSuperAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response"
import { batchCardActionSchema, batchCardAction } from "@/lib/domains/cards"

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }

  const parsed = batchCardActionSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  // DELETE requires super admin — auth check stays in route handler
  if (parsed.data.action === "DELETE") {
    const superSession = await getSuperAdminSession()
    if (!superSession) return unauthorized()
  }

  const result = await batchCardAction(parsed.data)
  return NextResponse.json(result)
}

export const runtime = "nodejs"
```

- [ ] **Step 2: Run the existing batch tests to verify they still pass**

```bash
npx jest __tests__/api/cards-batch.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/cards/batch/route.ts
git commit -m "refactor(cards): slim batch route handler, delegate to domain service"
```

---

## Task 9: Slim down app/api/products/[productId]/cards/route.ts

**Files:**
- Modify: `app/api/products/[productId]/cards/route.ts`

- [ ] **Step 1: Replace the route file content**

```typescript
// app/api/products/[productId]/cards/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound, invalidJsonBody, validationError, badRequest } from "@/lib/api-response"
import { bulkImportCardsSchema, bulkImportCards, getCardsByProduct, AutoFetchProductError } from "@/lib/domains/cards"

type RouteContext = { params: Promise<{ productId: string }> }

const VALID_STATUSES = ["UNSOLD", "RESERVED", "SOLD", "DISABLED"] as const
type CardStatus = (typeof VALID_STATUSES)[number]

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { productId } = await context.params

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
  if (!product) return notFound("Product not found")

  const { searchParams } = new URL(request.url)
  const rawStatus = searchParams.get("status")
  const status = VALID_STATUSES.includes(rawStatus as CardStatus) ? (rawStatus as CardStatus) : null

  const data = await getCardsByProduct(productId, status)
  return NextResponse.json(data)
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { productId } = await context.params

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, slug: true, price: true, productType: true },
  })
  if (!product) return notFound("Product not found")

  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }

  const parsed = bulkImportCardsSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  try {
    const result = await bulkImportCards(productId, { ...product, price: Number(product.price) }, parsed.data)
    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    if (e instanceof AutoFetchProductError) return badRequest(e.message)
    throw e
  }
}

export const runtime = "nodejs"
```

- [ ] **Step 2: Run the existing product cards tests to verify they still pass**

```bash
npx jest __tests__/api/products-cards-restock.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/api/products/[productId]/cards/route.ts"
git commit -m "refactor(cards): slim product cards route, delegate to domain service"
```

---

## Task 10: Slim down app/api/products/[productId]/cards/export/route.ts

**Files:**
- Modify: `app/api/products/[productId]/cards/export/route.ts`

- [ ] **Step 1: Replace the route file content**

```typescript
// app/api/products/[productId]/cards/export/route.ts
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound } from "@/lib/api-response"
import { exportCards } from "@/lib/domains/cards"
import type { CardStatus } from "@/lib/domains/cards"

type RouteContext = { params: Promise<{ productId: string }> }

const VALID_STATUSES = ["UNSOLD", "RESERVED", "SOLD", "DISABLED"] as const

const STATUS_LABELS: Record<CardStatus, string> = {
  UNSOLD: "未售",
  RESERVED: "预占中",
  SOLD: "已售",
  DISABLED: "停用",
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\u4e00-\u9fa5\-_.]/g, "_")
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { productId } = await context.params

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true },
  })
  if (!product) return notFound("Product not found")

  const { searchParams } = new URL(request.url)
  const rawStatus = searchParams.get("status")
  const status = VALID_STATUSES.includes(rawStatus as CardStatus) ? (rawStatus as CardStatus) : null

  const contents = await exportCards(productId, status)
  const text = contents.join("\n")

  const date = new Date().toISOString().slice(0, 10)
  const statusLabel = status ? STATUS_LABELS[status] : "全部"
  const safeName = sanitizeFilename(product.name)
  const filename = `${safeName}_卡密_${statusLabel}_${date}.txt`
  const encodedFilename = encodeURIComponent(filename)

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
    },
  })
}

export const runtime = "nodejs"
```

- [ ] **Step 2: Run the export test to verify it still passes**

```bash
npx jest __tests__/api/products-cards-export.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/api/products/[productId]/cards/export/route.ts"
git commit -m "refactor(cards): slim export route, delegate to domain service"
```

---

## Task 11: Update lib/validations/card.ts to re-export from domain

**Files:**
- Modify: `lib/validations/card.ts`

- [ ] **Step 1: Replace with re-exports (backwards compat for any future imports)**

```typescript
// lib/validations/card.ts
// Re-exported from domain module. Import directly from @/lib/domains/cards instead.
export {
  bulkImportCardsSchema,
  patchCardStatusSchema,
  batchCardActionSchema,
} from "@/lib/domains/cards"
export type {
  BulkImportCardsInput,
  PatchCardStatusInput,
  BatchCardActionInput,
} from "@/lib/domains/cards"
```

- [ ] **Step 2: Commit**

```bash
git add lib/validations/card.ts
git commit -m "refactor(cards): redirect lib/validations/card.ts to domain module"
```

---

## Task 12: Run all card-related tests and full test suite

- [ ] **Step 1: Run all card tests**

```bash
npx jest --testPathPattern="card" --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 2: Run the full test suite**

```bash
npm test -- --no-coverage
```

Expected: No new failures. All previously passing tests still pass.

- [ ] **Step 3: Final commit**

```bash
git commit --allow-empty -m "feat(cards-domain): pilot complete — FSD functional domain module"
```
