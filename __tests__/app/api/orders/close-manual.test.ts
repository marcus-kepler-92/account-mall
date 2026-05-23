/**
 * Close-order API — restock variant on CLOSED for MANUAL products
 *
 * PATCH /api/orders/[id] with { status: "CLOSED" }
 * - MANUAL order in AWAITING_FULFILLMENT → restock variant (+1) + close
 * - MANUAL order in PROCESSING            → restock variant (+1) + close
 * - COMPLETED order                       → rejected (illegal transition, 409)
 */
import { type NextRequest } from "next/server"
import { PATCH, DELETE } from "@/app/api/orders/[orderId]/route"
import { prismaMock } from "../../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("@/lib/complete-pending-order", () => ({
    __esModule: true,
    completePendingOrder: jest.fn(),
}))

import { getAdminSession } from "@/lib/auth-guard"

type RouteContext = { params: { orderId: string } }

function createJsonRequest(body: unknown): NextRequest {
    return { json: async () => body } as unknown as NextRequest
}

const PRODUCT_ID = "cmanualproduct000000000001"
const VARIANT_ID = "cmanualvariant000000000001"
const ORDER_ID = "cmanualorder0000000000001"

function makeManualOrder(status: "AWAITING_FULFILLMENT" | "PROCESSING" | "COMPLETED" | "PENDING" | "CLOSED") {
    return {
        id: ORDER_ID,
        orderNo: "FAK-MANUAL-1",
        status,
        productId: PRODUCT_ID,
        variantId: VARIANT_ID,
        product: { id: PRODUCT_ID, productType: "MANUAL", name: "Manual Product", price: 100 },
        cards: [],
    }
}

function makeReturnedOrder(status: string) {
    return {
        id: ORDER_ID,
        orderNo: "FAK-MANUAL-1",
        email: "buyer@example.com",
        productId: PRODUCT_ID,
        variantId: VARIANT_ID,
        quantity: 1,
        amount: 100,
        status,
        paidAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        product: { id: PRODUCT_ID, name: "Manual Product", price: 100 },
        cards: [],
    }
}

describe("PATCH /api/orders/[orderId] — MANUAL close restock", () => {
    const adminSessionMock = getAdminSession as jest.Mock

    beforeEach(() => {
        adminSessionMock.mockReset()
        ;(prismaMock.$transaction as jest.Mock).mockReset()
        ;(prismaMock.productVariant.update as jest.Mock).mockReset()
        adminSessionMock.mockResolvedValue({ id: "admin_1", user: { id: "admin_1", email: "admin@test.com" } })
    })

    it("PATCH MANUAL AWAITING_FULFILLMENT -> CLOSED restocks variant by 1 and closes order", async () => {
        prismaMock.order.findUnique
            .mockResolvedValueOnce(makeManualOrder("AWAITING_FULFILLMENT") as any)
            .mockResolvedValueOnce(makeReturnedOrder("CLOSED") as any)

        const txCalls: { table: string; args: unknown }[] = []
        ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
            const tx = {
                order: {
                    update: jest.fn(async (args: unknown) => {
                        txCalls.push({ table: "order.update", args })
                        return {}
                    }),
                },
                card: {
                    updateMany: jest.fn(async (args: unknown) => {
                        txCalls.push({ table: "card.updateMany", args })
                        return { count: 0 }
                    }),
                },
                productVariant: {
                    update: jest.fn(async (args: unknown) => {
                        txCalls.push({ table: "productVariant.update", args })
                        return {}
                    }),
                },
            }
            return fn(tx)
        })

        const res = await PATCH(
            createJsonRequest({ status: "CLOSED" }),
            { params: { orderId: ORDER_ID } } as any,
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.status).toBe("CLOSED")

        const variantUpdate = txCalls.find((c) => c.table === "productVariant.update")
        expect(variantUpdate).toBeDefined()
        expect(variantUpdate!.args).toMatchObject({
            where: { id: VARIANT_ID },
            data: { stockQuantity: { increment: 1 } },
        })

        const orderUpdate = txCalls.find((c) => c.table === "order.update")
        expect(orderUpdate).toBeDefined()
        expect(orderUpdate!.args).toMatchObject({
            where: { id: ORDER_ID },
            data: { status: "CLOSED" },
        })

        // PENDING-only card-unreserve must NOT fire for AWAITING_FULFILLMENT
        expect(txCalls.find((c) => c.table === "card.updateMany")).toBeUndefined()
    })

    it("PATCH MANUAL PROCESSING -> CLOSED restocks variant by 1 and closes order", async () => {
        prismaMock.order.findUnique
            .mockResolvedValueOnce(makeManualOrder("PROCESSING") as any)
            .mockResolvedValueOnce(makeReturnedOrder("CLOSED") as any)

        const txCalls: { table: string; args: unknown }[] = []
        ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
            const tx = {
                order: {
                    update: jest.fn(async (args: unknown) => {
                        txCalls.push({ table: "order.update", args })
                        return {}
                    }),
                },
                card: {
                    updateMany: jest.fn(async (args: unknown) => {
                        txCalls.push({ table: "card.updateMany", args })
                        return { count: 0 }
                    }),
                },
                productVariant: {
                    update: jest.fn(async (args: unknown) => {
                        txCalls.push({ table: "productVariant.update", args })
                        return {}
                    }),
                },
            }
            return fn(tx)
        })

        const res = await PATCH(
            createJsonRequest({ status: "CLOSED" }),
            { params: { orderId: ORDER_ID } } as any,
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.status).toBe("CLOSED")

        const variantUpdate = txCalls.find((c) => c.table === "productVariant.update")
        expect(variantUpdate).toBeDefined()
        expect(variantUpdate!.args).toMatchObject({
            where: { id: VARIANT_ID },
            data: { stockQuantity: { increment: 1 } },
        })
    })

    it("PATCH COMPLETED -> CLOSED rejects with 409 (illegal transition)", async () => {
        prismaMock.order.findUnique.mockResolvedValueOnce(makeManualOrder("COMPLETED") as any)

        const res = await PATCH(
            createJsonRequest({ status: "CLOSED" }),
            { params: { orderId: ORDER_ID } } as any,
        )
        const data = await res.json()

        expect(res.status).toBe(409)
        expect(data.error).toBe("Invalid status transition")
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })
})

/**
 * DELETE /api/orders/[orderId] — admin soft-close (mirror PATCH restock).
 *
 * Bug fix (I2): the DELETE handler used to set status=CLOSED and only
 * unreserve cards for PENDING. For a MANUAL order in AWAITING_FULFILLMENT
 * or PROCESSING, it must ALSO restock the variant by 1 (mirror PATCH CLOSED).
 */
describe("DELETE /api/orders/[orderId] — MANUAL soft-close restock", () => {
    const adminSessionMock = getAdminSession as jest.Mock

    function makeManualOrderTxFetch(
        status: "AWAITING_FULFILLMENT" | "PROCESSING" | "PENDING" | "CLOSED",
        opts: { productType?: "MANUAL" | "NORMAL"; variantId?: string | null } = {},
    ) {
        const { productType = "MANUAL", variantId = VARIANT_ID } = opts
        return {
            id: ORDER_ID,
            orderNo: "FAK-MANUAL-1",
            status,
            productId: PRODUCT_ID,
            variantId,
            product: { productType },
            cards: [],
        }
    }

    function runTxCapturing(orderForFetch: unknown) {
        const txCalls: { table: string; args: unknown }[] = []
        ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
            const tx = {
                order: {
                    findUnique: jest.fn(async () => orderForFetch),
                    update: jest.fn(async (args: unknown) => {
                        txCalls.push({ table: "order.update", args })
                        return {}
                    }),
                },
                card: {
                    updateMany: jest.fn(async (args: unknown) => {
                        txCalls.push({ table: "card.updateMany", args })
                        return { count: 0 }
                    }),
                },
                productVariant: {
                    update: jest.fn(async (args: unknown) => {
                        txCalls.push({ table: "productVariant.update", args })
                        return {}
                    }),
                },
            }
            return fn(tx)
        })
        return txCalls
    }

    beforeEach(() => {
        adminSessionMock.mockReset()
        ;(prismaMock.$transaction as jest.Mock).mockReset()
        ;(prismaMock.order.findUnique as jest.Mock).mockReset()
        adminSessionMock.mockResolvedValue({ id: "admin_1", user: { id: "admin_1", email: "admin@test.com" } })
    })

    it("DELETE MANUAL AWAITING_FULFILLMENT restocks variant by 1 + closes order", async () => {
        const txCalls = runTxCapturing(makeManualOrderTxFetch("AWAITING_FULFILLMENT"))
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeReturnedOrder("CLOSED") as any)

        const res = await DELETE(
            {} as any as NextRequest,
            { params: { orderId: ORDER_ID } } as any,
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.status).toBe("CLOSED")

        const orderUpdate = txCalls.find((c) => c.table === "order.update")
        expect(orderUpdate).toBeDefined()
        expect(orderUpdate!.args).toMatchObject({
            where: { id: ORDER_ID },
            data: { status: "CLOSED" },
        })

        const variantUpdate = txCalls.find((c) => c.table === "productVariant.update")
        expect(variantUpdate).toBeDefined()
        expect(variantUpdate!.args).toMatchObject({
            where: { id: VARIANT_ID },
            data: { stockQuantity: { increment: 1 } },
        })

        // PENDING-only card-unreserve must NOT fire for AWAITING_FULFILLMENT
        expect(txCalls.find((c) => c.table === "card.updateMany")).toBeUndefined()
    })

    it("DELETE MANUAL PROCESSING restocks variant by 1 + closes order", async () => {
        const txCalls = runTxCapturing(makeManualOrderTxFetch("PROCESSING"))
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeReturnedOrder("CLOSED") as any)

        const res = await DELETE(
            {} as any as NextRequest,
            { params: { orderId: ORDER_ID } } as any,
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.status).toBe("CLOSED")

        const variantUpdate = txCalls.find((c) => c.table === "productVariant.update")
        expect(variantUpdate).toBeDefined()
        expect(variantUpdate!.args).toMatchObject({
            where: { id: VARIANT_ID },
            data: { stockQuantity: { increment: 1 } },
        })
    })

    it("DELETE NORMAL PENDING does NOT touch variant (regression guard)", async () => {
        const txCalls = runTxCapturing(
            makeManualOrderTxFetch("PENDING", { productType: "NORMAL", variantId: null }),
        )
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeReturnedOrder("CLOSED") as any)

        const res = await DELETE(
            {} as any as NextRequest,
            { params: { orderId: ORDER_ID } } as any,
        )

        expect(res.status).toBe(200)
        expect(txCalls.find((c) => c.table === "productVariant.update")).toBeUndefined()
        // PENDING still unreserves cards
        expect(txCalls.find((c) => c.table === "card.updateMany")).toBeDefined()
    })
})
