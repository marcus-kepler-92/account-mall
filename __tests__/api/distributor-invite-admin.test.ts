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

jest.mock("@/lib/domains/distributors", () => ({
    sendInvite: jest.fn(),
    createNoEmailInviteLink: jest.fn(),
    distributorInviteSchema: require("zod").z.object({
        email: require("zod").z.string().email(),
    }),
}))

const getAdminSession = require("@/lib/auth-guard").getAdminSession as jest.Mock
const sendInvite = require("@/lib/domains/distributors").sendInvite as jest.Mock
const createNoEmailInviteLink = require("@/lib/domains/distributors").createNoEmailInviteLink as jest.Mock

function createRequest(body: unknown): NextRequest {
    return {
        json: () => Promise.resolve(body),
    } as unknown as NextRequest
}

describe("POST /api/admin/distributors/invite", () => {
    beforeEach(() => {
        getAdminSession.mockReset()
        sendInvite.mockReset()
        createNoEmailInviteLink.mockReset()
    })

    it("returns 401 when no session", async () => {
        getAdminSession.mockResolvedValue(null)
        const res = await AdminInvitePost(createRequest({ email: "new@example.com" }))
        expect(res.status).toBe(401)
        expect(sendInvite).not.toHaveBeenCalled()
    })

    it("returns 400 when email is invalid", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        const res = await AdminInvitePost(createRequest({ email: "not-an-email" }))
        expect(res.status).toBe(400)
        expect(sendInvite).not.toHaveBeenCalled()
    })

    it("returns 400 when body is invalid JSON", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        const req = { json: () => Promise.reject(new Error("Bad JSON")) } as unknown as NextRequest
        const res = await AdminInvitePost(req)
        expect(res.status).toBe(400)
    })

    it("returns 400 when email is already registered", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        sendInvite.mockResolvedValue({ success: false, reason: "already_registered" })

        const res = await AdminInvitePost(createRequest({ email: "existing@example.com" }))
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toMatch(/已注册/)
    })

    it("returns 200 and calls sendInvite with admin ID as inviterId", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        sendInvite.mockResolvedValue({ success: true })

        const res = await AdminInvitePost(createRequest({ email: "new@example.com" }))
        expect(res.status).toBe(200)
        expect(sendInvite).toHaveBeenCalledWith(
            expect.objectContaining({
                email: "new@example.com",
                inviterId: "admin_1",
                inviterName: "Admin",
            })
        )
    })

    it("normalizes email to lowercase", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        sendInvite.mockResolvedValue({ success: true })

        await AdminInvitePost(createRequest({ email: "New@EXAMPLE.COM" }))
        expect(sendInvite).toHaveBeenCalledWith(
            expect.objectContaining({ email: "new@example.com" })
        )
    })

    it("returns 400 when email send fails (send_failed)", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        sendInvite.mockResolvedValue({ success: false, reason: "send_failed" })

        const res = await AdminInvitePost(createRequest({ email: "new@example.com" }))
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toMatch(/邮件发送失败/)
    })

    it("calls createNoEmailInviteLink with default maxUses=1 when body has no email", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        createNoEmailInviteLink.mockResolvedValue({
            link: "https://example.com/distributor/accept-invite?token=abc",
        })
        const res = await AdminInvitePost(createRequest({}))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.link).toBe("https://example.com/distributor/accept-invite?token=abc")
        expect(sendInvite).not.toHaveBeenCalled()
        expect(createNoEmailInviteLink).toHaveBeenCalledWith({ inviterId: "admin_1", maxUses: 1 })
    })

    it("forwards maxUses to createNoEmailInviteLink", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        createNoEmailInviteLink.mockResolvedValue({
            link: "https://example.com/distributor/accept-invite?token=abc",
        })
        await AdminInvitePost(createRequest({ maxUses: 20 }))
        expect(createNoEmailInviteLink).toHaveBeenCalledWith({ inviterId: "admin_1", maxUses: 20 })
    })

    it("clamps float maxUses (1.7) to default 1 via integer guard", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        createNoEmailInviteLink.mockResolvedValue({ link: "https://example.com/invite?token=abc" })
        await AdminInvitePost(createRequest({ maxUses: 1.7 }))
        expect(createNoEmailInviteLink).toHaveBeenCalledWith({ inviterId: "admin_1", maxUses: 1 })
    })

    it("clamps negative maxUses (-5) to default 1", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        createNoEmailInviteLink.mockResolvedValue({ link: "https://example.com/invite?token=abc" })
        await AdminInvitePost(createRequest({ maxUses: -5 }))
        expect(createNoEmailInviteLink).toHaveBeenCalledWith({ inviterId: "admin_1", maxUses: 1 })
    })

    it("clamps over-limit maxUses (100) to inviteLinkMaxCount (50)", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        createNoEmailInviteLink.mockResolvedValue({ link: "https://example.com/invite?token=abc" })
        await AdminInvitePost(createRequest({ maxUses: 100 }))
        expect(createNoEmailInviteLink).toHaveBeenCalledWith({ inviterId: "admin_1", maxUses: 50 })
    })

    it("returns 401 when unauthenticated admin tries no-email invite", async () => {
        getAdminSession.mockResolvedValue(null)
        const res = await AdminInvitePost(createRequest({}))
        expect(res.status).toBe(401)
        expect(createNoEmailInviteLink).not.toHaveBeenCalled()
    })

    it("calls sendInvite with lowercase email", async () => {
        getAdminSession.mockResolvedValue({ user: { id: "admin_1", name: "Admin" } })
        sendInvite.mockResolvedValue({ success: true })

        const res = await AdminInvitePost(createRequest({ email: "Test@Example.COM" }))
        expect(res.status).toBe(200)
        expect(sendInvite).toHaveBeenCalledWith(
            expect.objectContaining({ email: "test@example.com" })
        )
    })
})
