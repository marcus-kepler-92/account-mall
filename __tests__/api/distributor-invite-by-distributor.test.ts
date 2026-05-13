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

jest.mock("@/lib/domains/distributors", () => {
    const { distributorInviteSchema } = jest.requireActual("@/lib/domains/distributors/validators")
    return {
        distributorInviteSchema,
        sendInvite: jest.fn(),
        createNoEmailInviteLink: jest.fn(),
    }
})

const getDistributorSession = require("@/lib/auth-guard").getDistributorSession as jest.Mock
const sendInvite = require("@/lib/domains/distributors").sendInvite as jest.Mock
const createNoEmailInviteLink = require("@/lib/domains/distributors").createNoEmailInviteLink as jest.Mock

function createRequest(body: unknown): NextRequest {
    return {
        json: () => Promise.resolve(body),
    } as unknown as NextRequest
}

describe("POST /api/distributor/invite", () => {
    beforeEach(() => {
        getDistributorSession.mockReset()
        sendInvite.mockReset()
        createNoEmailInviteLink.mockReset()
    })

    it("returns 401 when no session", async () => {
        getDistributorSession.mockResolvedValue(null)
        const res = await DistInvitePost(createRequest({ email: "new@example.com" }))
        expect(res.status).toBe(401)
        expect(sendInvite).not.toHaveBeenCalled()
    })

    it("returns 401 when distributor is disabled", async () => {
        getDistributorSession.mockResolvedValue({
            user: { id: "dist_1", name: "Dist", disabledAt: "2025-01-01T00:00:00.000Z" },
        })
        const res = await DistInvitePost(createRequest({ email: "new@example.com" }))
        expect(res.status).toBe(401)
        expect(sendInvite).not.toHaveBeenCalled()
    })

    it("returns 400 when email is invalid", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        const res = await DistInvitePost(createRequest({ email: "bad-email" }))
        expect(res.status).toBe(400)
        expect(sendInvite).not.toHaveBeenCalled()
    })

    it("returns 400 when email already registered", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        sendInvite.mockResolvedValue({ success: false, reason: "already_registered" })

        const res = await DistInvitePost(createRequest({ email: "existing@example.com" }))
        expect(res.status).toBe(400)
    })

    it("returns 200 and calls sendInvite with distributor ID as inviterId", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Distributor A" } })
        sendInvite.mockResolvedValue({ success: true })

        const res = await DistInvitePost(createRequest({ email: "newmember@example.com" }))
        expect(res.status).toBe(200)
        expect(sendInvite).toHaveBeenCalledWith(
            expect.objectContaining({
                email: "newmember@example.com",
                inviterId: "dist_1",
                inviterName: "Distributor A",
            })
        )
    })

    it("allows same email to be invited by multiple people (no duplicate check)", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        sendInvite.mockResolvedValue({ success: true })

        const res = await DistInvitePost(createRequest({ email: "shared@example.com" }))
        expect(res.status).toBe(200)
        expect(sendInvite).toHaveBeenCalledTimes(1)
    })

    it("returns 400 when email send fails (send_failed)", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        sendInvite.mockResolvedValue({ success: false, reason: "send_failed" })

        const res = await DistInvitePost(createRequest({ email: "new@example.com" }))
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toMatch(/邮件发送失败/)
    })

    it("returns 400 when distributor invites their own registered email", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        sendInvite.mockResolvedValue({ success: false, reason: "already_registered" })

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

    it("calls createNoEmailInviteLink with default maxUses=1 when body has no email", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        createNoEmailInviteLink.mockResolvedValue({
            link: "https://example.com/distributor/accept-invite?token=abc",
        })
        const res = await DistInvitePost(createRequest({}))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.link).toBe("https://example.com/distributor/accept-invite?token=abc")
        expect(sendInvite).not.toHaveBeenCalled()
        expect(createNoEmailInviteLink).toHaveBeenCalledWith({ inviterId: "dist_1", maxUses: 1 })
    })

    it("forwards maxUses to createNoEmailInviteLink", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        createNoEmailInviteLink.mockResolvedValue({
            link: "https://example.com/distributor/accept-invite?token=abc",
        })
        await DistInvitePost(createRequest({ maxUses: 15 }))
        expect(createNoEmailInviteLink).toHaveBeenCalledWith({ inviterId: "dist_1", maxUses: 15 })
    })

    it("clamps float maxUses (1.7) to default 1 via integer guard", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        createNoEmailInviteLink.mockResolvedValue({ link: "https://example.com/invite?token=abc" })
        await DistInvitePost(createRequest({ maxUses: 1.7 }))
        expect(createNoEmailInviteLink).toHaveBeenCalledWith({ inviterId: "dist_1", maxUses: 1 })
    })

    it("clamps negative maxUses (-5) to default 1", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        createNoEmailInviteLink.mockResolvedValue({ link: "https://example.com/invite?token=abc" })
        await DistInvitePost(createRequest({ maxUses: -5 }))
        expect(createNoEmailInviteLink).toHaveBeenCalledWith({ inviterId: "dist_1", maxUses: 1 })
    })

    it("clamps over-limit maxUses (100) to inviteLinkMaxCount (50)", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "dist_1", name: "Dist" } })
        createNoEmailInviteLink.mockResolvedValue({ link: "https://example.com/invite?token=abc" })
        await DistInvitePost(createRequest({ maxUses: 100 }))
        expect(createNoEmailInviteLink).toHaveBeenCalledWith({ inviterId: "dist_1", maxUses: 50 })
    })

    it("returns 401 when disabled distributor tries to generate no-email link", async () => {
        getDistributorSession.mockResolvedValue({
            user: { id: "dist_1", name: "Dist", disabledAt: "2025-01-01T00:00:00.000Z" },
        })
        const res = await DistInvitePost(createRequest({}))
        expect(res.status).toBe(401)
        expect(createNoEmailInviteLink).not.toHaveBeenCalled()
    })
})
