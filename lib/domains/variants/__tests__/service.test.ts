// lib/domains/variants/__tests__/service.test.ts
import { createVariantForProduct, deleteVariantById, updateVariantById } from "../service"
import { NotManualProductError, VariantHasOrdersError, VariantNotFoundError } from "../types"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findUnique: jest.fn(), update: jest.fn() },
    productVariant: {
      create: jest.fn(), findUnique: jest.fn(), update: jest.fn(),
      delete: jest.fn(), count: jest.fn(), findMany: jest.fn(),
    },
    order: { count: jest.fn() },
  },
}))

const p = prisma as unknown as {
  product: { findUnique: jest.Mock; update: jest.Mock }
  productVariant: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock; count: jest.Mock; findMany: jest.Mock }
  order: { count: jest.Mock }
}

const mockVariant = {
  id: "v1",
  productId: "prod1",
  name: "X",
  price: { toString: () => "9.90" },
  unitCost: null,
  stockQuantity: 1,
  sortOrder: 0,
  isActive: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
}

describe("variants service", () => {
  beforeEach(() => jest.clearAllMocks())

  it("rejects createVariantForProduct on NORMAL product", async () => {
    p.product.findUnique.mockResolvedValue({ productType: "NORMAL" })
    await expect(
      createVariantForProduct("prod1", { name: "X", price: 9.9, stockQuantity: 1 }),
    ).rejects.toBeInstanceOf(NotManualProductError)
  })

  it("rejects createVariantForProduct when product does not exist", async () => {
    p.product.findUnique.mockResolvedValue(null)
    await expect(
      createVariantForProduct("prod_missing", { name: "X", price: 9.9, stockQuantity: 1 }),
    ).rejects.toBeInstanceOf(NotManualProductError)
  })

  it("creates a variant for a MANUAL product", async () => {
    p.product.findUnique.mockResolvedValue({ productType: "MANUAL" })
    p.productVariant.create.mockResolvedValue({ ...mockVariant })
    const row = await createVariantForProduct("prod1", { name: "X", price: 9.9, stockQuantity: 1 })
    expect(row.id).toBe("v1")
    expect(row.price).toBe("9.90")
    expect(p.productVariant.create).toHaveBeenCalled()
  })

  it("rejects delete when orders exist", async () => {
    p.productVariant.findUnique.mockResolvedValue({ id: "v1", productId: "prod1" })
    p.order.count.mockResolvedValue(2)
    await expect(deleteVariantById("v1")).rejects.toBeInstanceOf(VariantHasOrdersError)
  })

  it("throws VariantNotFoundError when deleting unknown variant", async () => {
    p.productVariant.findUnique.mockResolvedValue(null)
    await expect(deleteVariantById("v_missing")).rejects.toBeInstanceOf(VariantNotFoundError)
  })

  it("throws VariantNotFoundError when updating unknown variant", async () => {
    p.productVariant.findUnique.mockResolvedValue(null)
    await expect(updateVariantById("v_missing", { name: "Y" })).rejects.toBeInstanceOf(
      VariantNotFoundError,
    )
  })

  it("auto-deactivates product when last active variant deactivated", async () => {
    p.productVariant.findUnique.mockResolvedValue({ id: "v1", productId: "prod1", isActive: true })
    p.productVariant.update.mockResolvedValue({
      id: "v1", productId: "prod1", name: "X", price: { toString: () => "9.9" }, unitCost: null,
      stockQuantity: 0, sortOrder: 0, isActive: false, createdAt: new Date(),
    })
    p.productVariant.count.mockResolvedValue(0)
    p.product.update.mockResolvedValue({})

    await updateVariantById("v1", { isActive: false })

    expect(p.product.update).toHaveBeenCalledWith({
      where: { id: "prod1" },
      data: { status: "INACTIVE" },
    })
  })

  it("does not deactivate product when other active variants remain", async () => {
    p.productVariant.findUnique.mockResolvedValue({ id: "v1", productId: "prod1", isActive: true })
    p.productVariant.update.mockResolvedValue({
      id: "v1", productId: "prod1", name: "X", price: { toString: () => "9.9" }, unitCost: null,
      stockQuantity: 0, sortOrder: 0, isActive: false, createdAt: new Date(),
    })
    p.productVariant.count.mockResolvedValue(2)

    await updateVariantById("v1", { isActive: false })

    expect(p.product.update).not.toHaveBeenCalled()
  })

  it("deactivates product when last active variant is deleted", async () => {
    p.productVariant.findUnique.mockResolvedValue({ id: "v1", productId: "prod1" })
    p.order.count.mockResolvedValue(0)
    p.productVariant.delete.mockResolvedValue({})
    p.productVariant.count.mockResolvedValue(0)
    p.product.update.mockResolvedValue({})

    await deleteVariantById("v1")

    expect(p.productVariant.delete).toHaveBeenCalledWith({ where: { id: "v1" } })
    expect(p.product.update).toHaveBeenCalledWith({
      where: { id: "prod1" },
      data: { status: "INACTIVE" },
    })
  })
})
