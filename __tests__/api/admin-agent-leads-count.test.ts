import { GET } from "@/app/api/admin/agent/leads/count/route"

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("@/lib/prisma", () => ({
    __esModule: true,
    prisma: {
        agentLead: { count: jest.fn() },
    },
}))

const getAdminSession =
    require("@/lib/auth-guard").getAdminSession as jest.Mock
const leadCount = (require("@/lib/prisma") as {
    prisma: { agentLead: { count: jest.Mock } }
}).prisma.agentLead.count

describe("GET /api/admin/agent/leads/count", () => {
    beforeEach(() => {
        getAdminSession.mockReset()
        leadCount.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        getAdminSession.mockResolvedValue(null)
        const res = await GET()
        expect(res.status).toBe(401)
        expect(leadCount).not.toHaveBeenCalled()
    })

    it("counts only NEW + CONTACTED — matches the 主待办 default filter so badge stays in sync with click-through view", async () => {
        // PENDING_CONTACT is intentionally excluded: ops doesn't proactively
        // contact those (留微信但没主动联系 = passive), counting them in the
        // todo badge would over-state the actionable workload.
        // RESOLVED / DROPPED are closed.
        getAdminSession.mockResolvedValue({ user: { id: "admin_1" } })
        leadCount.mockResolvedValue(7)
        const res = await GET()
        expect(leadCount).toHaveBeenCalledWith({
            where: { status: { in: ["NEW", "CONTACTED"] } },
        })
        const body = await res.json()
        expect(body).toEqual({ pending: 7 })
    })

    it("returns 0 (not error) when there are no pending leads", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1" } })
        leadCount.mockResolvedValue(0)
        const res = await GET()
        const body = await res.json()
        expect(body).toEqual({ pending: 0 })
    })
})
