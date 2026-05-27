import { type NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("@/lib/prisma", () => ({
    prisma: {
        agentLead: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    },
}))

import { PATCH } from "@/app/api/admin/agent/leads/[id]/route"
import { getAdminSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

const adminSession = { user: { id: "admin_1" } }

function jsonRequest(body: unknown): NextRequest {
    return {
        json: () => Promise.resolve(body),
    } as unknown as NextRequest
}

function ctx(id: string) {
    return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
    jest.clearAllMocks()
    ;(getAdminSession as jest.Mock).mockResolvedValue(adminSession)
})

describe("PATCH /api/admin/agent/leads/[id]", () => {
    it("returns 401 when not authenticated", async () => {
        ;(getAdminSession as jest.Mock).mockResolvedValueOnce(null)
        const res = await PATCH(jsonRequest({ status: "CONTACTED" }), ctx("l1"))
        expect(res.status).toBe(401)
    })

    it("returns 404 when lead does not exist", async () => {
        ;(prisma.agentLead.findUnique as jest.Mock).mockResolvedValueOnce(null)
        const res = await PATCH(jsonRequest({ status: "CONTACTED" }), ctx("missing"))
        expect(res.status).toBe(404)
        expect(prisma.agentLead.update).not.toHaveBeenCalled()
    })

    it("rejects illegal transition NEW → PENDING_CONTACT with 409", async () => {
        ;(prisma.agentLead.findUnique as jest.Mock).mockResolvedValueOnce({
            id: "l1",
            status: "NEW",
        })
        const res = await PATCH(
            jsonRequest({ status: "PENDING_CONTACT" }),
            ctx("l1"),
        )
        expect(res.status).toBe(409)
        const body = await res.json()
        expect(body.error).toContain("NEW")
        expect(body.error).toContain("PENDING_CONTACT")
        expect(prisma.agentLead.update).not.toHaveBeenCalled()
    })

    it("rejects self-loop CONTACTED → CONTACTED with 409 (avoids contactedAt re-stamp)", async () => {
        ;(prisma.agentLead.findUnique as jest.Mock).mockResolvedValueOnce({
            id: "l1",
            status: "CONTACTED",
        })
        const res = await PATCH(jsonRequest({ status: "CONTACTED" }), ctx("l1"))
        expect(res.status).toBe(409)
        expect(prisma.agentLead.update).not.toHaveBeenCalled()
    })

    it("rejects outbound transition from terminal RESOLVED with 409", async () => {
        ;(prisma.agentLead.findUnique as jest.Mock).mockResolvedValueOnce({
            id: "l1",
            status: "RESOLVED",
        })
        const res = await PATCH(jsonRequest({ status: "CONTACTED" }), ctx("l1"))
        expect(res.status).toBe(409)
        expect(prisma.agentLead.update).not.toHaveBeenCalled()
    })

    it("allows NEW → DROPPED (the 'not handled is also fulfill' path)", async () => {
        ;(prisma.agentLead.findUnique as jest.Mock).mockResolvedValueOnce({
            id: "l1",
            status: "NEW",
        })
        ;(prisma.agentLead.update as jest.Mock).mockResolvedValueOnce({
            id: "l1",
            status: "DROPPED",
        })
        const res = await PATCH(jsonRequest({ status: "DROPPED" }), ctx("l1"))
        expect(res.status).toBe(200)
        expect(prisma.agentLead.update).toHaveBeenCalledWith({
            where: { id: "l1" },
            data: { status: "DROPPED" },
        })
    })

    it("allows NEW → RESOLVED (out-of-band resolution)", async () => {
        ;(prisma.agentLead.findUnique as jest.Mock).mockResolvedValueOnce({
            id: "l1",
            status: "NEW",
        })
        ;(prisma.agentLead.update as jest.Mock).mockResolvedValueOnce({
            id: "l1",
            status: "RESOLVED",
        })
        const res = await PATCH(jsonRequest({ status: "RESOLVED" }), ctx("l1"))
        expect(res.status).toBe(200)
    })

    it("stamps contactedAt/By on NEW → CONTACTED", async () => {
        ;(prisma.agentLead.findUnique as jest.Mock).mockResolvedValueOnce({
            id: "l1",
            status: "NEW",
        })
        ;(prisma.agentLead.update as jest.Mock).mockResolvedValueOnce({
            id: "l1",
            status: "CONTACTED",
        })
        const res = await PATCH(jsonRequest({ status: "CONTACTED" }), ctx("l1"))
        expect(res.status).toBe(200)
        const call = (prisma.agentLead.update as jest.Mock).mock.calls[0][0]
        expect(call.where).toEqual({ id: "l1" })
        expect(call.data.status).toBe("CONTACTED")
        expect(call.data.contactedBy).toBe("admin_1")
        expect(call.data.contactedAt).toBeInstanceOf(Date)
    })

    it("notes-only PATCH skips transition gate and updates notes even on terminal lead", async () => {
        ;(prisma.agentLead.findUnique as jest.Mock).mockResolvedValueOnce({
            id: "l1",
            status: "RESOLVED",
        })
        ;(prisma.agentLead.update as jest.Mock).mockResolvedValueOnce({
            id: "l1",
            status: "RESOLVED",
            notes: "after-the-fact note",
        })
        const res = await PATCH(
            jsonRequest({ notes: "after-the-fact note" }),
            ctx("l1"),
        )
        expect(res.status).toBe(200)
        expect(prisma.agentLead.update).toHaveBeenCalledWith({
            where: { id: "l1" },
            data: { notes: "after-the-fact note" },
        })
    })

    it("drops notes when accompanying status is illegal (whole request rejected)", async () => {
        ;(prisma.agentLead.findUnique as jest.Mock).mockResolvedValueOnce({
            id: "l1",
            status: "RESOLVED",
        })
        const res = await PATCH(
            jsonRequest({ status: "NEW", notes: "should not be written" }),
            ctx("l1"),
        )
        expect(res.status).toBe(409)
        expect(prisma.agentLead.update).not.toHaveBeenCalled()
    })
})
