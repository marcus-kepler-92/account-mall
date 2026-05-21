import { GET } from "@/app/api/admin/notifications/route"

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("@/lib/admin-permissions", () => ({
    __esModule: true,
    getAdminPermissions: jest.fn(),
}))

jest.mock("@/lib/admin-notifications", () => {
    const fetchWith = jest.fn(async () => ({ count: 1, items: [] }))
    const fetchAgent = jest.fn(async () => ({ count: 2, items: [] }))
    const fetchInv = jest.fn(async () => ({
        count: 3,
        breakdown: { outOfStock: 1, lowStock: 1, restockWaiting: 1 },
        items: [],
    }))
    return {
        __esModule: true,
        SOURCES: [
            { key: "withdrawals", menuHref: "/admin/withdrawals", fetch: fetchWith },
            { key: "agentLeads", menuHref: "/admin/agent/leads", fetch: fetchAgent },
            { key: "inventoryAlerts", menuHref: "/admin/products", fetch: fetchInv },
        ],
        __fetchSpies: { fetchWith, fetchAgent, fetchInv },
    }
})

const { getAdminSession } = jest.requireMock("@/lib/auth-guard") as {
    getAdminSession: jest.Mock
}
const { getAdminPermissions } = jest.requireMock("@/lib/admin-permissions") as {
    getAdminPermissions: jest.Mock
}
const spies = (
    jest.requireMock("@/lib/admin-notifications") as {
        __fetchSpies: Record<string, jest.Mock>
    }
).__fetchSpies

beforeEach(() => {
    getAdminSession.mockReset()
    getAdminPermissions.mockReset()
    Object.values(spies).forEach((s) => s.mockClear())
})

describe("GET /api/admin/notifications", () => {
    it("returns 401 when unauthenticated", async () => {
        getAdminSession.mockResolvedValue(null)
        const res = await GET()
        expect(res.status).toBe(401)
    })

    it("returns all sources when allowedMenus is null (super admin)", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1" } })
        getAdminPermissions.mockResolvedValue({ allowedMenus: null })
        const res = await GET()
        const body = await res.json()
        expect(body.sources.map((s: { key: string }) => s.key).sort()).toEqual([
            "agentLeads",
            "inventoryAlerts",
            "withdrawals",
        ])
    })

    it("filters sources by allowedMenus", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_2" } })
        getAdminPermissions.mockResolvedValue({ allowedMenus: ["/admin/products"] })
        const res = await GET()
        const body = await res.json()
        expect(body.sources).toHaveLength(1)
        expect(body.sources[0].key).toBe("inventoryAlerts")
        expect(spies.fetchWith).not.toHaveBeenCalled()
        expect(spies.fetchAgent).not.toHaveBeenCalled()
    })

    it("omits a source when its fetch throws (does not 500)", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1" } })
        getAdminPermissions.mockResolvedValue({ allowedMenus: null })
        spies.fetchWith.mockRejectedValueOnce(new Error("boom"))
        const res = await GET()
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.sources.map((s: { key: string }) => s.key).sort()).toEqual([
            "agentLeads",
            "inventoryAlerts",
        ])
    })
})
