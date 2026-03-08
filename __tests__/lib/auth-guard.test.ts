/**
 * Auth guard tests: getAdminSession, getDistributorSession (including disabled distributor).
 */
jest.mock("next/headers", () => ({
    headers: jest.fn().mockResolvedValue(new Headers()),
}))

const mockGetSession = jest.fn()
jest.mock("@/lib/auth", () => ({
    auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}))

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

import { getDistributorSession, getAdminSession } from "@/lib/auth-guard"
import { prismaMock } from "../../__mocks__/prisma"

describe("getDistributorSession", () => {
    beforeEach(() => {
        mockGetSession.mockReset()
        prismaMock.user.findUnique.mockReset()
    })

    it("returns null when no session", async () => {
        mockGetSession.mockResolvedValue(null)
        expect(await getDistributorSession()).toBeNull()
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it("returns null when user role is not DISTRIBUTOR", async () => {
        mockGetSession.mockResolvedValue({
            user: { id: "u1", email: "a@b.com", name: "A", role: "ADMIN" },
        })
        expect(await getDistributorSession()).toBeNull()
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it("returns null when distributor is disabled (disabledAt set)", async () => {
        mockGetSession.mockResolvedValue({
            user: { id: "dist_1", email: "d@b.com", name: "D", role: "DISTRIBUTOR" },
        })
        prismaMock.user.findUnique.mockResolvedValue({
            disabledAt: new Date("2025-01-01"),
        })
        expect(await getDistributorSession()).toBeNull()
        expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: { id: "dist_1" },
            select: { disabledAt: true },
        })
    })

    it("returns session when distributor is not disabled", async () => {
        const session = {
            user: { id: "dist_1", email: "d@b.com", name: "D", role: "DISTRIBUTOR" },
        }
        mockGetSession.mockResolvedValue(session)
        prismaMock.user.findUnique.mockResolvedValue({ disabledAt: null })
        expect(await getDistributorSession()).toEqual(session)
    })
})

describe("getAdminSession", () => {
    beforeEach(() => {
        mockGetSession.mockReset()
    })

    it("returns null when no session", async () => {
        mockGetSession.mockResolvedValue(null)
        expect(await getAdminSession()).toBeNull()
    })

    it("returns null when user role is not ADMIN", async () => {
        mockGetSession.mockResolvedValue({
            user: { id: "u1", email: "a@b.com", name: "A", role: "DISTRIBUTOR" },
        })
        expect(await getAdminSession()).toBeNull()
    })

    it("returns session when user is ADMIN", async () => {
        const session = {
            user: { id: "admin_1", email: "a@b.com", name: "Admin", role: "ADMIN" },
        }
        mockGetSession.mockResolvedValue(session)
        expect(await getAdminSession()).toEqual(session)
    })
})
