import { createNoEmailInviteLink } from "@/lib/create-no-email-invite-link"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/config", () => ({
    config: {
        distributorInviteTtlDays: 7,
        siteUrl: "https://example.com",
        inviteLinkDefaultCount: 1,
        inviteLinkMaxCount: 50,
    },
}))

describe("createNoEmailInviteLink", () => {
    beforeEach(() => {
        prismaMock.distributorInvitation.create.mockReset()
    })

    it("creates DistributorInvitation with email=null and returns accept-invite link", async () => {
        prismaMock.distributorInvitation.create.mockResolvedValue({} as any)
        const result = await createNoEmailInviteLink({ inviterId: "inv_1" })
        expect(result.link).toMatch(
            /^https:\/\/example\.com\/distributor\/accept-invite\?token=[0-9a-f-]{36}$/
        )
        expect(prismaMock.distributorInvitation.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    email: null,
                    inviterId: "inv_1",
                    maxUses: 1,
                }),
            })
        )
    })

    it("defaults maxUses to 1 when not specified", async () => {
        prismaMock.distributorInvitation.create.mockResolvedValue({} as any)
        await createNoEmailInviteLink({ inviterId: "inv_1" })
        expect(prismaMock.distributorInvitation.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ maxUses: 1 }),
            })
        )
    })

    it("passes maxUses to invitation record", async () => {
        prismaMock.distributorInvitation.create.mockResolvedValue({} as any)
        await createNoEmailInviteLink({ inviterId: "inv_1", maxUses: 20 })
        expect(prismaMock.distributorInvitation.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ maxUses: 20 }),
            })
        )
    })

    it("clamps maxUses to 50 when over limit", async () => {
        prismaMock.distributorInvitation.create.mockResolvedValue({} as any)
        await createNoEmailInviteLink({ inviterId: "inv_1", maxUses: 999 })
        expect(prismaMock.distributorInvitation.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ maxUses: 50 }),
            })
        )
    })

    it("clamps maxUses to 1 when below minimum", async () => {
        prismaMock.distributorInvitation.create.mockResolvedValue({} as any)
        await createNoEmailInviteLink({ inviterId: "inv_1", maxUses: 0 })
        expect(prismaMock.distributorInvitation.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ maxUses: 1 }),
            })
        )
    })

    it("sets expiresAt approximately 7 days from now", async () => {
        prismaMock.distributorInvitation.create.mockResolvedValue({} as any)
        const before = Date.now()
        await createNoEmailInviteLink({ inviterId: "inv_1" })
        const after = Date.now()

        const createCall = prismaMock.distributorInvitation.create.mock.calls[0][0]
        const expiresAt: Date = createCall.data.expiresAt
        const expectedMs = 7 * 24 * 60 * 60 * 1000
        expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedMs - 1000)
        expect(expiresAt.getTime()).toBeLessThanOrEqual(after + expectedMs + 1000)
    })
})
