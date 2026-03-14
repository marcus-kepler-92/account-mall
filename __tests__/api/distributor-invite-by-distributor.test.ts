import { type NextRequest } from "next/server"
import { POST as DistInvitePost } from "@/app/api/distributor/invite/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getDistributorSession: jest.fn(),
}))

jest.mock("@/lib/send-distributor-invitation", () => ({
    sendDistributorInvitation: jest.fn(),
}))

jest.mock("@/lib/rate-limit", () => ({
    checkDistributorInviteRateLimit: jest.fn().mockResolvedValue(null),
}))

const getDistributorSession = require("@/lib/auth-guard").getDistributorSession as jest.Mock
const sendDistributorInvitation = require("@/lib/send-distributor-invitation").sendDistributorInvitation as jest.Mock
const checkDistributorInviteRateLimit = require("@/lib/rate-limit").checkDistributorInviteRateLimit as jest.Mock

function createRequest(body: unknown): NextRequest {
    return {
        json: () => Promise.resolve(body),
    } as unknown as NextRequest
}

describe("POST /api/distributor/invite", () => {
    beforeEach(() => {
        getDistributorSession.mockReset()
        sendDistributorInvitation.mockReset()
    })

    it("returns 401 when no session", async () => {
        getDistributorSession.mockResolvedValue(null)
        const res = await DistInvitePost(createRequest({ email: "new@example.com" }))
        expect(res.status).toBe(401)
        expect(sendDistributorInvitation).not.toHaveBeenCalled()
    })

    it("returns 401 when distributor is disabled", async () => {
        getDistributorSession.mockResolvedValue({
            user: { id: "dist_1", name: "Dist", disabledAt: "2025-01-01T00:00:00.000Z" },
        })
        const res = await DistInvitePost(createRequest({ email: "new@example.com" }))
        expect(res.status).toBe(401)
        expect(sendDistributorInvitation).not.toHaveBeenCalled()
    })

    it("returns 400 when email is invalid", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        const res = await DistInvitePost(createRequest({ email: "bad-email" }))
        expect(res.status).toBe(400)
        expect(sendDistributorInvitation).not.toHaveBeenCalled()
    })

    it("returns 400 when email already registered", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        sendDistributorInvitation.mockResolvedValue({ success: false, reason: "already_registered" })

        const res = await DistInvitePost(createRequest({ email: "existing@example.com" }))
        expect(res.status).toBe(400)
    })

    it("returns 200 and calls sendDistributorInvitation with distributor ID as inviterId", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Distributor A" } })
        sendDistributorInvitation.mockResolvedValue({ success: true })

        const res = await DistInvitePost(createRequest({ email: "newmember@example.com" }))
        expect(res.status).toBe(200)
        expect(sendDistributorInvitation).toHaveBeenCalledWith(
            expect.objectContaining({
                email: "newmember@example.com",
                inviterId: "dist_1",
                inviterName: "Distributor A",
            })
        )
    })

    it("allows same email to be invited by multiple people (no duplicate check)", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        sendDistributorInvitation.mockResolvedValue({ success: true })

        const res = await DistInvitePost(createRequest({ email: "shared@example.com" }))
        expect(res.status).toBe(200)
        expect(sendDistributorInvitation).toHaveBeenCalledTimes(1)
    })

    it("returns 429 when rate limited", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        checkDistributorInviteRateLimit.mockResolvedValueOnce(
            new Response(JSON.stringify({ error: "邀请发送过于频繁" }), { status: 429 })
        )
        const res = await DistInvitePost(createRequest({ email: "new@example.com" }))
        expect(res.status).toBe(429)
        expect(sendDistributorInvitation).not.toHaveBeenCalled()
    })

    it("returns 400 when email send fails (send_failed)", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        sendDistributorInvitation.mockResolvedValue({ success: false, reason: "send_failed" })

        const res = await DistInvitePost(createRequest({ email: "new@example.com" }))
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toMatch(/邮件发送失败/)
    })

    it("returns 400 when distributor invites their own registered email", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        sendDistributorInvitation.mockResolvedValue({ success: false, reason: "already_registered" })

        const res = await DistInvitePost(createRequest({ email: "dist1@example.com" }))
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toMatch(/已注册/)
    })

    it("returns 400 when body is invalid JSON", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        const req = { json: () => Promise.reject(new Error("Bad JSON")) } as unknown as NextRequest
        const res = await DistInvitePost(req)
        expect(res.status).toBe(400)
    })
})
