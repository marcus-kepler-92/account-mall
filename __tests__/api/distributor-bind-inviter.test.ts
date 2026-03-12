import { type NextRequest } from "next/server"
import { POST as BindInviterPost } from "@/app/api/distributor/bind-inviter/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getDistributorSession: jest.fn(),
}))

const getDistributorSession = require("@/lib/auth-guard").getDistributorSession as jest.Mock

function createRequest(body: { inviteCode: string }): NextRequest {
    return {
        json: () => Promise.resolve(body),
    } as unknown as NextRequest
}

describe("POST /api/distributor/bind-inviter", () => {
    beforeEach(() => {
        getDistributorSession.mockReset()
        prismaMock.user.findFirst.mockReset()
        prismaMock.user.update.mockReset()
    })

    it("returns 401 when no session", async () => {
        getDistributorSession.mockResolvedValue(null)
        const res = await BindInviterPost(createRequest({ inviteCode: "CODE1" }))
        expect(res.status).toBe(401)
        expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it("returns 400 when body is invalid JSON", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "user_1" } })
        const req = { json: () => Promise.reject(new Error("Invalid JSON")) } as unknown as NextRequest
        const res = await BindInviterPost(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toBeDefined()
    })

    it("returns 400 when inviteCode is empty", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "user_1" } })
        const res = await BindInviterPost(createRequest({ inviteCode: "" }))
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/邀请码|参数/)
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it("returns 400 when inviteCode is invalid or inviter disabled", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "user_1" } })
        prismaMock.user.findFirst.mockResolvedValue(null)
        const res = await BindInviterPost(createRequest({ inviteCode: "INVALID" }))
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/邀请码无效|邀请人已停用/)
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it("returns 400 when binding self as inviter", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "user_1" } })
        prismaMock.user.findFirst.mockResolvedValue({ id: "user_1" })
        const res = await BindInviterPost(createRequest({ inviteCode: "MYCODE" }))
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/自己|邀请人/)
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it("returns 200 and updates user inviterId when inviteCode is valid", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "invitee_1" } })
        prismaMock.user.findFirst.mockResolvedValue({ id: "inviter_1" })
        prismaMock.user.update.mockResolvedValue({})
        const res = await BindInviterPost(createRequest({ inviteCode: "PROMO1" }))
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).toEqual({ ok: true })
        expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
            where: {
                distributorCode: "PROMO1",
                role: "DISTRIBUTOR",
                disabledAt: null,
            },
            select: { id: true },
        })
        expect(prismaMock.user.update).toHaveBeenCalledWith({
            where: { id: "invitee_1" },
            data: { inviterId: "inviter_1" },
        })
    })

    it("trims inviteCode before lookup", async () => {
        getDistributorSession.mockResolvedValue({ user: { id: "invitee_1" } })
        prismaMock.user.findFirst.mockResolvedValue({ id: "inviter_1" })
        prismaMock.user.update.mockResolvedValue({})
        await BindInviterPost(createRequest({ inviteCode: "  PROMO1  " }))
        expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ distributorCode: "PROMO1" }),
            })
        )
    })
})
