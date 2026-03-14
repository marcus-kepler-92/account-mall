import { type NextRequest } from "next/server"
import { POST as AdminInvitePost } from "@/app/api/admin/distributors/invite/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("@/lib/send-distributor-invitation", () => ({
    sendDistributorInvitation: jest.fn(),
}))

const getAdminSession = require("@/lib/auth-guard").getAdminSession as jest.Mock
const sendDistributorInvitation = require("@/lib/send-distributor-invitation").sendDistributorInvitation as jest.Mock

function createRequest(body: unknown): NextRequest {
    return {
        json: () => Promise.resolve(body),
    } as unknown as NextRequest
}

describe("POST /api/admin/distributors/invite", () => {
    beforeEach(() => {
        getAdminSession.mockReset()
        sendDistributorInvitation.mockReset()
    })

    it("returns 401 when no session", async () => {
        getAdminSession.mockResolvedValue(null)
        const res = await AdminInvitePost(createRequest({ email: "new@example.com" }))
        expect(res.status).toBe(401)
        expect(sendDistributorInvitation).not.toHaveBeenCalled()
    })

    it("returns 400 when email is invalid", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        const res = await AdminInvitePost(createRequest({ email: "not-an-email" }))
        expect(res.status).toBe(400)
        expect(sendDistributorInvitation).not.toHaveBeenCalled()
    })

    it("returns 400 when body is invalid JSON", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        const req = { json: () => Promise.reject(new Error("Bad JSON")) } as unknown as NextRequest
        const res = await AdminInvitePost(req)
        expect(res.status).toBe(400)
    })

    it("returns 400 when email is already registered", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        sendDistributorInvitation.mockResolvedValue({ success: false, reason: "already_registered" })

        const res = await AdminInvitePost(createRequest({ email: "existing@example.com" }))
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toMatch(/已注册/)
    })

    it("returns 200 and calls sendDistributorInvitation with admin ID as inviterId", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        sendDistributorInvitation.mockResolvedValue({ success: true })

        const res = await AdminInvitePost(createRequest({ email: "new@example.com" }))
        expect(res.status).toBe(200)
        expect(sendDistributorInvitation).toHaveBeenCalledWith(
            expect.objectContaining({
                email: "new@example.com",
                inviterId: "admin_1",
                inviterName: "Admin",
            })
        )
    })

    it("normalizes email to lowercase", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        sendDistributorInvitation.mockResolvedValue({ success: true })

        await AdminInvitePost(createRequest({ email: "New@EXAMPLE.COM" }))
        expect(sendDistributorInvitation).toHaveBeenCalledWith(
            expect.objectContaining({ email: "new@example.com" })
        )
    })

    it("returns 400 when email send fails (send_failed)", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        sendDistributorInvitation.mockResolvedValue({ success: false, reason: "send_failed" })

        const res = await AdminInvitePost(createRequest({ email: "new@example.com" }))
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toMatch(/邮件发送失败/)
    })
})
