import { POST } from "@/app/api/admin/close-expired-orders/route"

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("@/lib/close-expired-orders", () => ({
    __esModule: true,
    closeExpiredOrders: jest.fn(),
}))

import { getAdminSession } from "@/lib/auth-guard"
import { closeExpiredOrders } from "@/lib/close-expired-orders"

const getAdminSessionMock = getAdminSession as jest.Mock
const closeExpiredOrdersMock = closeExpiredOrders as jest.Mock

describe("POST /api/admin/close-expired-orders", () => {
    beforeEach(() => {
        getAdminSessionMock.mockReset()
        closeExpiredOrdersMock.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        getAdminSessionMock.mockResolvedValue(null)
        const res = await POST()
        expect(res.status).toBe(401)
        const data = await res.json()
        expect(data.error).toBe("Unauthorized")
        expect(closeExpiredOrdersMock).not.toHaveBeenCalled()
    })

    it("returns { closed: 0, total: 0 } when no expired orders", async () => {
        getAdminSessionMock.mockResolvedValue({ id: "admin_1" })
        closeExpiredOrdersMock.mockResolvedValue({ closed: 0, total: 0 })
        const res = await POST()
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).toEqual({ closed: 0, total: 0 })
        expect(closeExpiredOrdersMock).toHaveBeenCalledTimes(1)
    })

    it("returns closed count when expired orders exist", async () => {
        getAdminSessionMock.mockResolvedValue({ id: "admin_1" })
        closeExpiredOrdersMock.mockResolvedValue({ closed: 3, total: 3 })
        const res = await POST()
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).toEqual({ closed: 3, total: 3 })
    })
})
