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

import { getDistributorSession, getAdminSession, getSessionForAdminArea, getSuperAdminSession } from "@/lib/auth-guard"
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
        } as any)
        expect(await getDistributorSession()).toBeNull()
        expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: { id: "dist_1" },
        })
    })

    it("returns session when distributor is not disabled", async () => {
        const session = {
            user: { id: "dist_1", email: "d@b.com", name: "D", role: "DISTRIBUTOR" },
        }
        mockGetSession.mockResolvedValue(session)
        prismaMock.user.findUnique.mockResolvedValue({ disabledAt: null } as any)
        expect(await getDistributorSession()).toEqual(session)
    })
})

describe("getAdminSession", () => {
    beforeEach(() => {
        mockGetSession.mockReset()
        prismaMock.user.findUnique.mockReset()
    })

    it("returns null when no session", async () => {
        mockGetSession.mockResolvedValue(null)
        expect(await getAdminSession()).toBeNull()
    })

    it("returns null when user role is not ADMIN", async () => {
        mockGetSession.mockResolvedValue({
            user: { id: "u1", email: "a@b.com", name: "A", role: "DISTRIBUTOR" },
        })
        prismaMock.user.findUnique.mockResolvedValue({ role: "DISTRIBUTOR", adminRole: null, mustChangePassword: false } as any)
        expect(await getAdminSession()).toBeNull()
    })

    it("returns session when user is ADMIN", async () => {
        const session = {
            user: { id: "admin_1", email: "a@b.com", name: "Admin", role: "ADMIN" },
        }
        mockGetSession.mockResolvedValue(session)
        prismaMock.user.findUnique.mockResolvedValue({ role: "ADMIN", adminRole: null, mustChangePassword: false } as any)
        expect(await getAdminSession()).toEqual(session)
    })

    it("returns session when user is ADMIN with sub-role", async () => {
        const session = { user: { id: "sub_1", email: "s@b.com", name: "Sub", role: "ADMIN" } }
        mockGetSession.mockResolvedValue(session)
        prismaMock.user.findUnique.mockResolvedValue({ role: "ADMIN", adminRole: "SYSTEM_OPS", mustChangePassword: false } as any)
        expect(await getAdminSession()).toEqual(session)
    })

    it("returns null when mustChangePassword is true", async () => {
        const session = { user: { id: "admin_2", email: "b@b.com", name: "Admin2", role: "ADMIN" } }
        mockGetSession.mockResolvedValue(session)
        prismaMock.user.findUnique.mockResolvedValue({ role: "ADMIN", adminRole: null, mustChangePassword: true } as any)
        expect(await getAdminSession()).toBeNull()
    })
})

describe("getSessionForAdminArea", () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    prismaMock.user.findUnique.mockReset()
  })

  it("returns null when no session", async () => {
    mockGetSession.mockResolvedValue(null)
    expect(await getSessionForAdminArea()).toBeNull()
  })

  it("returns null when dbUser not found", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "ghost" } })
    prismaMock.user.findUnique.mockResolvedValue(null)
    expect(await getSessionForAdminArea()).toBeNull()
  })

  it("returns role, adminRole, and mustChangePassword from DB", async () => {
    const session = { user: { id: "a1", email: "a@b.com", name: "A" } }
    mockGetSession.mockResolvedValue(session)
    prismaMock.user.findUnique.mockResolvedValue({
      role: "ADMIN",
      adminRole: "SYSTEM_OPS",
      mustChangePassword: true,
    } as any)

    const result = await getSessionForAdminArea()
    expect(result).not.toBeNull()
    expect(result!.role).toBe("ADMIN")
    expect(result!.adminRole).toBe("SYSTEM_OPS")
    expect(result!.mustChangePassword).toBe(true)
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "a1" },
      select: { role: true, adminRole: true, mustChangePassword: true },
    })
  })
})

describe("getSuperAdminSession", () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    prismaMock.user.findUnique.mockReset()
  })

  it("returns null when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null)
    expect(await getSuperAdminSession()).toBeNull()
  })

  it("returns null when role is not ADMIN", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } })
    prismaMock.user.findUnique.mockResolvedValue({ role: "DISTRIBUTOR", adminRole: null, mustChangePassword: false } as any)
    expect(await getSuperAdminSession()).toBeNull()
  })

  it("returns null when user is a sub-role admin (adminRole !== null)", async () => {
    const session = { user: { id: "a1" } }
    mockGetSession.mockResolvedValue(session)
    prismaMock.user.findUnique.mockResolvedValue({ role: "ADMIN", adminRole: "SYSTEM_OPS", mustChangePassword: false } as any)
    expect(await getSuperAdminSession()).toBeNull()
  })

  it("returns session when user is super admin (ADMIN + adminRole null)", async () => {
    const session = { user: { id: "a1" } }
    mockGetSession.mockResolvedValue(session)
    prismaMock.user.findUnique.mockResolvedValue({ role: "ADMIN", adminRole: null, mustChangePassword: false } as any)
    expect(await getSuperAdminSession()).toEqual(session)
  })
})
