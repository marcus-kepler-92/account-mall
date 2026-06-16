/**
 * Batch order API — CLOSE must release reserved cards
 *
 * POST /api/orders/batch { action: "CLOSE", orderIds }
 * - NORMAL/MANUAL PENDING orders → release reserved cards (RESERVED → UNSOLD, orderId null)
 * - AUTO_FETCH PENDING orders    → delete temporary reserved cards
 * - Non-PENDING orders           → skipped, not closed
 *
 * Regression: batch CLOSE previously only set status=CLOSED and leaked the
 * reservation (cards stuck RESERVED + bound to a closed order).
 */
import { type NextRequest } from "next/server"
import { POST } from "@/app/api/orders/batch/route"
import { prismaMock } from "../../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
    getSuperAdminSession: jest.fn(),
}))

import { getAdminSession } from "@/lib/auth-guard"

function createJsonRequest(body: unknown): NextRequest {
    return { json: async () => body } as unknown as NextRequest
}

const NORMAL_ID = "cnormalorder000000000001"
const AUTO_ID = "cautoorder00000000000001"
const COMPLETED_ID = "ccompletedorder000000001"

function makeOrder(id: string, status: string, productType: "NORMAL" | "AUTO_FETCH" | "MANUAL") {
    return { id, status, product: { productType } }
}

describe("POST /api/orders/batch — CLOSE releases reserved cards", () => {
    const adminSessionMock = getAdminSession as jest.Mock

    beforeEach(() => {
        adminSessionMock.mockReset()
        ;(prismaMock.order.findMany as jest.Mock).mockReset()
        ;(prismaMock.$transaction as jest.Mock).mockReset()
        adminSessionMock.mockResolvedValue({ id: "admin_1", user: { id: "admin_1", email: "admin@test.com" } })
    })

    function runTxCapturing() {
        const txCalls: { table: string; args: unknown }[] = []
        ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
            const tx = {
                order: {
                    updateMany: jest.fn(async (args: unknown) => {
                        txCalls.push({ table: "order.updateMany", args })
                        return { count: 0 }
                    }),
                },
                card: {
                    updateMany: jest.fn(async (args: unknown) => {
                        txCalls.push({ table: "card.updateMany", args })
                        return { count: 0 }
                    }),
                    deleteMany: jest.fn(async (args: unknown) => {
                        txCalls.push({ table: "card.deleteMany", args })
                        return { count: 0 }
                    }),
                },
            }
            return fn(tx)
        })
        return txCalls
    }

    it("CLOSE NORMAL PENDING releases reserved cards back to inventory", async () => {
        ;(prismaMock.order.findMany as jest.Mock).mockResolvedValueOnce([
            makeOrder(NORMAL_ID, "PENDING", "NORMAL"),
        ])
        const txCalls = runTxCapturing()

        const res = await POST(createJsonRequest({ action: "CLOSE", orderIds: [NORMAL_ID] }))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toMatchObject({ success: 1, skipped: 0 })

        const orderUpdate = txCalls.find((c) => c.table === "order.updateMany")
        expect(orderUpdate!.args).toMatchObject({
            where: { id: { in: [NORMAL_ID] } },
            data: { status: "CLOSED" },
        })

        const cardRelease = txCalls.find((c) => c.table === "card.updateMany")
        expect(cardRelease).toBeDefined()
        expect(cardRelease!.args).toMatchObject({
            where: { orderId: { in: [NORMAL_ID] }, status: "RESERVED" },
            data: { status: "UNSOLD", orderId: null },
        })
        expect(txCalls.find((c) => c.table === "card.deleteMany")).toBeUndefined()
    })

    it("CLOSE AUTO_FETCH PENDING deletes temporary reserved cards", async () => {
        ;(prismaMock.order.findMany as jest.Mock).mockResolvedValueOnce([
            makeOrder(AUTO_ID, "PENDING", "AUTO_FETCH"),
        ])
        const txCalls = runTxCapturing()

        const res = await POST(createJsonRequest({ action: "CLOSE", orderIds: [AUTO_ID] }))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toMatchObject({ success: 1, skipped: 0 })

        const cardDelete = txCalls.find((c) => c.table === "card.deleteMany")
        expect(cardDelete).toBeDefined()
        expect(cardDelete!.args).toMatchObject({
            where: { orderId: { in: [AUTO_ID] }, status: "RESERVED" },
        })
        expect(txCalls.find((c) => c.table === "card.updateMany")).toBeUndefined()
    })

    it("CLOSE skips non-PENDING orders (no card mutation)", async () => {
        ;(prismaMock.order.findMany as jest.Mock).mockResolvedValueOnce([
            makeOrder(COMPLETED_ID, "COMPLETED", "NORMAL"),
        ])
        runTxCapturing()

        const res = await POST(createJsonRequest({ action: "CLOSE", orderIds: [COMPLETED_ID] }))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toMatchObject({ success: 0, skipped: 1 })
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("CLOSE mixed batch: NORMAL releases, AUTO_FETCH deletes, COMPLETED skipped", async () => {
        ;(prismaMock.order.findMany as jest.Mock).mockResolvedValueOnce([
            makeOrder(NORMAL_ID, "PENDING", "NORMAL"),
            makeOrder(AUTO_ID, "PENDING", "AUTO_FETCH"),
            makeOrder(COMPLETED_ID, "COMPLETED", "NORMAL"),
        ])
        const txCalls = runTxCapturing()

        const res = await POST(
            createJsonRequest({ action: "CLOSE", orderIds: [NORMAL_ID, AUTO_ID, COMPLETED_ID] }),
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toMatchObject({ success: 2, skipped: 1 })

        const cardRelease = txCalls.find((c) => c.table === "card.updateMany")
        expect(cardRelease!.args).toMatchObject({
            where: { orderId: { in: [NORMAL_ID] }, status: "RESERVED" },
        })
        const cardDelete = txCalls.find((c) => c.table === "card.deleteMany")
        expect(cardDelete!.args).toMatchObject({
            where: { orderId: { in: [AUTO_ID] }, status: "RESERVED" },
        })
    })
})
