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
    await bulkImportCards("prod_1", product, { contents: ["code1", "code1", "code1"], unitCost: null })
    expect(createManyCards).toHaveBeenCalledWith("prod_1", ["code1"], null)
  })

  it("triggers restock notify when stock goes from 0 to non-zero", async () => {
    ;(countUnsoldCards as jest.Mock).mockResolvedValue(0)
    ;(createManyCards as jest.Mock).mockResolvedValue({ count: 2 })
    await bulkImportCards("prod_1", product, { contents: ["code1", "code2"], unitCost: null })
    expect(notifyRestockSubscribers).toHaveBeenCalledWith({
      id: "prod_1",
      name: "Test Product",
      slug: "test-product",
      price: 9.99,
      productType: "NORMAL",
    })
  })

  it("does not trigger restock notify when stock was already non-zero", async () => {
    ;(countUnsoldCards as jest.Mock).mockResolvedValue(5)
    ;(createManyCards as jest.Mock).mockResolvedValue({ count: 2 })
    await bulkImportCards("prod_1", product, { contents: ["code1", "code2"], unitCost: null })
    expect(notifyRestockSubscribers).not.toHaveBeenCalled()
  })

  it("returns imported count and total", async () => {
    ;(countUnsoldCards as jest.Mock).mockResolvedValue(0)
    ;(createManyCards as jest.Mock).mockResolvedValue({ count: 2 })
    const result = await bulkImportCards("prod_1", product, { contents: ["code1", "code2"], unitCost: null })
    expect(result).toEqual({ imported: 2, total: 2 })
  })

  it("passes unitCost through to createManyCards when provided", async () => {
    ;(countUnsoldCards as jest.Mock).mockResolvedValue(0)
    ;(createManyCards as jest.Mock).mockResolvedValue({ count: 2 })
    await bulkImportCards("prod_1", product, { contents: ["code1", "code2"], unitCost: 5.5 })
    expect(createManyCards).toHaveBeenCalledWith("prod_1", ["code1", "code2"], 5.5)
  })

  it("passes unitCost=0 (e.g. free batch) through to createManyCards", async () => {
    ;(countUnsoldCards as jest.Mock).mockResolvedValue(0)
    ;(createManyCards as jest.Mock).mockResolvedValue({ count: 1 })
    await bulkImportCards("prod_1", product, { contents: ["code1"], unitCost: 0 })
    expect(createManyCards).toHaveBeenCalledWith("prod_1", ["code1"], 0)
  })
})

// ── bulkImportCardsSchema validation ──────────────────────────────────────────

describe("bulkImportCardsSchema", () => {
  const { bulkImportCardsSchema } = require("../validators") as {
    bulkImportCardsSchema: import("zod").ZodType<{ contents: string[]; unitCost: number | null }>
  }

  it("accepts payload without unitCost (defaults to null)", () => {
    const parsed = bulkImportCardsSchema.parse({ contents: ["c1"] })
    expect(parsed).toEqual({ contents: ["c1"], unitCost: null })
  })

  it("accepts non-negative unitCost with 2 decimals", () => {
    const parsed = bulkImportCardsSchema.parse({ contents: ["c1"], unitCost: 12.34 })
    expect(parsed.unitCost).toBe(12.34)
  })

  it("rejects negative unitCost", () => {
    expect(() => bulkImportCardsSchema.parse({ contents: ["c1"], unitCost: -1 })).toThrow()
  })

  it("rejects unitCost with more than 2 decimal places", () => {
    expect(() => bulkImportCardsSchema.parse({ contents: ["c1"], unitCost: 0.123 })).toThrow()
  })

  it("rejects unitCost exceeding Decimal(10, 2) max", () => {
    expect(() =>
      bulkImportCardsSchema.parse({ contents: ["c1"], unitCost: 99999999999 }),
    ).toThrow()
  })

  it("rejects NaN / Infinity unitCost", () => {
    expect(() => bulkImportCardsSchema.parse({ contents: ["c1"], unitCost: Number.NaN })).toThrow()
    expect(() =>
      bulkImportCardsSchema.parse({ contents: ["c1"], unitCost: Number.POSITIVE_INFINITY }),
    ).toThrow()
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
