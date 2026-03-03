import { type NextRequest } from "next/server"
import { DELETE, PATCH } from "@/app/api/cards/[cardId]/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return {
        __esModule: true,
        prisma: prismaMock,
    }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

import { getAdminSession } from "@/lib/auth-guard"

type RouteContext = { params: Promise<{ cardId: string }> }

function createContext(cardId: string): RouteContext {
    return { params: Promise.resolve({ cardId }) }
}

describe("DELETE /api/cards/[cardId]", () => {
    const adminSessionMock = getAdminSession as jest.Mock

    beforeEach(() => {
        adminSessionMock.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        adminSessionMock.mockResolvedValueOnce(null)

        const res = await DELETE(
            {} as NextRequest,
            createContext("card_1") as any
        )
        const data = await res.json()

        expect(res.status).toBe(401)
        expect(data).toEqual({ error: "Unauthorized" })
    })

    it("returns 404 when card does not exist", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.card.findUnique.mockResolvedValueOnce(null)

        const res = await DELETE(
            {} as NextRequest,
            createContext("nonexistent") as any
        )
        const data = await res.json()

        expect(res.status).toBe(404)
        expect(data).toEqual({ error: "Card not found" })
    })

    it("returns 400 when card is not UNSOLD", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.card.findUnique.mockResolvedValueOnce({
            id: "card_1",
            status: "SOLD",
        })

        const res = await DELETE(
            {} as NextRequest,
            createContext("card_1") as any
        )
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data).toEqual({
            error: "Only unsold cards can be deleted",
        })
        expect(prismaMock.card.delete).not.toHaveBeenCalled()
    })

    it("deletes UNSOLD card and returns 200", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.card.findUnique.mockResolvedValueOnce({
            id: "card_1",
            status: "UNSOLD",
        })
        prismaMock.card.delete.mockResolvedValueOnce({} as any)

        const res = await DELETE(
            {} as NextRequest,
            createContext("card_1") as any
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({ message: "Card deleted" })
        expect(prismaMock.card.delete).toHaveBeenCalledWith({
            where: { id: "card_1" },
        })
    })
})

describe("PATCH /api/cards/[cardId]", () => {
    const adminSessionMock = getAdminSession as jest.Mock

    beforeEach(() => {
        adminSessionMock.mockReset()
        prismaMock.card.findUnique.mockReset()
        prismaMock.card.update.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        adminSessionMock.mockResolvedValueOnce(null)

        const res = await PATCH(
            new Request("http://x", {
                method: "PATCH",
                body: JSON.stringify({ status: "DISABLED" }),
            }) as NextRequest,
            createContext("card_1") as any
        )
        const data = await res.json()

        expect(res.status).toBe(401)
        expect(data).toEqual({ error: "Unauthorized" })
    })

    it("returns 404 when card does not exist", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.card.findUnique.mockResolvedValueOnce(null)

        const res = await PATCH(
            new Request("http://x", {
                method: "PATCH",
                body: JSON.stringify({ status: "DISABLED" }),
            }) as NextRequest,
            createContext("nonexistent") as any
        )
        const data = await res.json()

        expect(res.status).toBe(404)
        expect(data).toEqual({ error: "Card not found" })
    })

    it("returns 400 when disabling non-UNSOLD card", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.card.findUnique.mockResolvedValueOnce({
            id: "card_1",
            status: "SOLD",
        })

        const res = await PATCH(
            new Request("http://x", {
                method: "PATCH",
                body: JSON.stringify({ status: "DISABLED" }),
            }) as NextRequest,
            createContext("card_1") as any
        )
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.error).toContain("Only unsold cards can be disabled")
        expect(prismaMock.card.update).not.toHaveBeenCalled()
    })

    it("disables UNSOLD card and returns 200", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.card.findUnique.mockResolvedValueOnce({
            id: "card_1",
            status: "UNSOLD",
        })
        prismaMock.card.update.mockResolvedValueOnce({} as any)

        const res = await PATCH(
            new Request("http://x", {
                method: "PATCH",
                body: JSON.stringify({ status: "DISABLED" }),
            }) as NextRequest,
            createContext("card_1") as any
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({ message: "Card disabled", status: "DISABLED" })
        expect(prismaMock.card.update).toHaveBeenCalledWith({
            where: { id: "card_1" },
            data: { status: "DISABLED" },
        })
    })

    it("returns 400 when enabling non-DISABLED card", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.card.findUnique.mockResolvedValueOnce({
            id: "card_1",
            status: "UNSOLD",
        })

        const res = await PATCH(
            new Request("http://x", {
                method: "PATCH",
                body: JSON.stringify({ status: "UNSOLD" }),
            }) as NextRequest,
            createContext("card_1") as any
        )
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.error).toContain("Only disabled cards can be re-enabled")
        expect(prismaMock.card.update).not.toHaveBeenCalled()
    })

    it("enables DISABLED card and returns 200", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.card.findUnique.mockResolvedValueOnce({
            id: "card_1",
            status: "DISABLED",
        })
        prismaMock.card.update.mockResolvedValueOnce({} as any)

        const res = await PATCH(
            new Request("http://x", {
                method: "PATCH",
                body: JSON.stringify({ status: "UNSOLD" }),
            }) as NextRequest,
            createContext("card_1") as any
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({ message: "Card enabled", status: "UNSOLD" })
        expect(prismaMock.card.update).toHaveBeenCalledWith({
            where: { id: "card_1" },
            data: { status: "UNSOLD" },
        })
    })
})
