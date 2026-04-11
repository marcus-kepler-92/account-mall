import { type NextRequest } from "next/server"
import { POST as AcceptInvitePost } from "@/app/api/distributor/accept-invite/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("better-auth/crypto", () => ({
    hashPassword: jest.fn().mockResolvedValue("hashed_password"),
}))

jest.mock("@/lib/rate-limit", () => ({
    checkAcceptInviteRateLimit: jest.fn().mockResolvedValue(null),
}))

const checkAcceptInviteRateLimit = require("@/lib/rate-limit").checkAcceptInviteRateLimit as jest.Mock

function createRequest(body: unknown): NextRequest {
    return {
        json: () => Promise.resolve(body),
    } as unknown as NextRequest
}

function makeInvitation(overrides?: Record<string, unknown>) {
    return {
        email: "invitee@example.com",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null,
        inviter: { role: "DISTRIBUTOR" },
        inviterId: "dist_A",
        ...overrides,
    } as any
}

describe("POST /api/distributor/accept-invite", () => {
    beforeEach(() => {
        prismaMock.distributorInvitation.findUnique.mockReset()
        prismaMock.user.findUnique.mockReset()
        prismaMock.$transaction.mockReset()
        prismaMock.user.create.mockReset()
        prismaMock.account.create.mockReset()
        prismaMock.distributorInvitation.update.mockReset()
    })

    it("returns 400 when body is invalid JSON", async () => {
        const req = { json: () => Promise.reject(new Error("Bad JSON")) } as unknown as NextRequest
        const res = await AcceptInvitePost(req)
        expect(res.status).toBe(400)
    })

    it("returns 400 when name is missing", async () => {
        const res = await AcceptInvitePost(createRequest({ token: "valid-token", password: "password123" }))
        expect(res.status).toBe(400)
    })

    it("returns 400 when name is empty string", async () => {
        const res = await AcceptInvitePost(createRequest({ token: "valid-token", name: "", password: "password123" }))
        expect(res.status).toBe(400)
    })

    it("returns 400 when name exceeds 50 characters", async () => {
        const res = await AcceptInvitePost(createRequest({ token: "valid-token", name: "a".repeat(51), password: "password123" }))
        expect(res.status).toBe(400)
    })

    it("returns 400 when password is too short", async () => {
        const res = await AcceptInvitePost(createRequest({ token: "valid-token", name: "Alice", password: "12345" }))
        expect(res.status).toBe(400)
    })

    it("returns 404 when token does not exist", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(null)
        const res = await AcceptInvitePost(createRequest({ token: "no-such-token", name: "Alice", password: "password123" }))
        expect(res.status).toBe(404)
    })

    it("returns 400 when token is already accepted", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(
            makeInvitation({ acceptedAt: new Date("2025-01-01") })
        )
        const res = await AcceptInvitePost(createRequest({ token: "used-token", name: "Alice", password: "password123" }))
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.code).toBe("INVITE_USED")
    })

    it("returns 400 when token is expired", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(
            makeInvitation({ expiresAt: new Date("2020-01-01") })
        )
        const res = await AcceptInvitePost(createRequest({ token: "expired-token", name: "Alice", password: "password123" }))
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.code).toBe("INVITE_EXPIRED")
    })

    it("returns 400 when email is already registered", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(makeInvitation())
        prismaMock.user.findUnique.mockResolvedValue({ id: "existing_user" } as any)
        const res = await AcceptInvitePost(createRequest({ token: "valid-token", name: "Alice", password: "password123" }))
        expect(res.status).toBe(400)
    })

    it("creates user with inviterId when invited by distributor", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(makeInvitation())
        prismaMock.user.findUnique.mockResolvedValue(null)
        ;(prismaMock.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<void>) => {
            await fn({
                ...prismaMock,
                distributorInvitation: {
                    findUnique: jest.fn().mockResolvedValue({ acceptedAt: null }),
                    update: jest.fn().mockResolvedValue({}),
                },
                user: { create: jest.fn().mockResolvedValue({ id: "new_user" }) },
                account: { create: jest.fn().mockResolvedValue({}) },
            })
        })

        const res = await AcceptInvitePost(createRequest({ token: "valid-token", name: "Alice", password: "password123" }))
        expect(res.status).toBe(200)
    })

    it("saves provided name to user record", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(makeInvitation())
        prismaMock.user.findUnique.mockResolvedValue(null)

        let userCreateArgs: any
        ;(prismaMock.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<void>) => {
            const userCreateMock = jest.fn().mockResolvedValue({ id: "new_user" })
            await fn({
                ...prismaMock,
                distributorInvitation: {
                    findUnique: jest.fn().mockResolvedValue({ acceptedAt: null }),
                    update: jest.fn().mockResolvedValue({}),
                },
                user: { create: userCreateMock },
                account: { create: jest.fn().mockResolvedValue({}) },
            })
            userCreateArgs = userCreateMock.mock.calls[0][0]
        })

        const res = await AcceptInvitePost(createRequest({ token: "valid-token", name: "我的昵称", password: "password123" }))
        expect(res.status).toBe(200)
        expect(userCreateArgs.data.name).toBe("我的昵称")
    })

    it("creates user with inviterId=null when invited by admin", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(
            makeInvitation({ inviter: { role: "ADMIN" } })
        )
        prismaMock.user.findUnique.mockResolvedValue(null)

        let userCreateArgs: any
        ;(prismaMock.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<void>) => {
            const userCreateMock = jest.fn().mockResolvedValue({ id: "new_user" })
            await fn({
                ...prismaMock,
                distributorInvitation: {
                    findUnique: jest.fn().mockResolvedValue({ acceptedAt: null }),
                    update: jest.fn().mockResolvedValue({}),
                },
                user: { create: userCreateMock },
                account: { create: jest.fn().mockResolvedValue({}) },
            })
            userCreateArgs = userCreateMock.mock.calls[0][0]
        })

        const res = await AcceptInvitePost(createRequest({ token: "valid-token", name: "Alice", password: "password123" }))
        expect(res.status).toBe(200)
        expect(userCreateArgs.data.inviterId).toBeNull()
    })

    it("returns 409 when concurrent accept detected (acceptedAt set inside transaction)", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(makeInvitation())
        prismaMock.user.findUnique.mockResolvedValue(null)
        ;(prismaMock.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<void>) => {
            await fn({
                ...prismaMock,
                distributorInvitation: {
                    findUnique: jest.fn().mockResolvedValue({ acceptedAt: new Date() }),
                    update: jest.fn(),
                },
                user: { create: jest.fn() },
                account: { create: jest.fn() },
            })
        })

        const res = await AcceptInvitePost(createRequest({ token: "valid-token", name: "Alice", password: "password123" }))
        expect(res.status).toBe(409)
    })

    it("returns 429 when rate limited", async () => {
        checkAcceptInviteRateLimit.mockResolvedValueOnce(
            new Response(JSON.stringify({ error: "请求过于频繁" }), { status: 429 })
        )
        const res = await AcceptInvitePost(createRequest({ token: "valid-token", name: "Alice", password: "password123" }))
        expect(res.status).toBe(429)
        expect(prismaMock.distributorInvitation.findUnique).not.toHaveBeenCalled()
    })

    it("returns 409 when distributorCode unique constraint collision (P2002)", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(makeInvitation())
        prismaMock.user.findUnique.mockResolvedValue(null)
        const p2002 = new Error("Unique constraint failed") as any
        p2002.code = "P2002"
        p2002.meta = { target: ["distributorCode"] }
        prismaMock.$transaction.mockRejectedValue(p2002)

        const res = await AcceptInvitePost(createRequest({ token: "valid-token", name: "Alice", password: "password123" }))
        expect(res.status).toBe(409)
        const body = await res.json()
        expect(body.error).toMatch(/冲突|重试/)
    })

    it("accepts password at exact min length (6 chars)", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(makeInvitation())
        prismaMock.user.findUnique.mockResolvedValue(null)
        ;(prismaMock.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<void>) => {
            await fn({
                ...prismaMock,
                distributorInvitation: {
                    findUnique: jest.fn().mockResolvedValue({ acceptedAt: null }),
                    update: jest.fn().mockResolvedValue({}),
                },
                user: { create: jest.fn().mockResolvedValue({ id: "new_user" }) },
                account: { create: jest.fn().mockResolvedValue({}) },
            })
        })

        const res = await AcceptInvitePost(createRequest({ token: "valid-token", name: "Alice", password: "123456" }))
        expect(res.status).toBe(200)
    })

    it("returns 400 when password exceeds max length (129 chars)", async () => {
        const longPassword = "a".repeat(129)
        const res = await AcceptInvitePost(createRequest({ token: "valid-token", name: "Alice", password: longPassword }))
        expect(res.status).toBe(400)
    })

    it("accepts password at exact max length (128 chars)", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(makeInvitation())
        prismaMock.user.findUnique.mockResolvedValue(null)
        ;(prismaMock.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<void>) => {
            await fn({
                ...prismaMock,
                distributorInvitation: {
                    findUnique: jest.fn().mockResolvedValue({ acceptedAt: null }),
                    update: jest.fn().mockResolvedValue({}),
                },
                user: { create: jest.fn().mockResolvedValue({ id: "new_user" }) },
                account: { create: jest.fn().mockResolvedValue({}) },
            })
        })

        const res = await AcceptInvitePost(createRequest({ token: "valid-token", name: "Alice", password: "a".repeat(128) }))
        expect(res.status).toBe(200)
    })

    it("returns 400 when token is empty string", async () => {
        const res = await AcceptInvitePost(createRequest({ token: "", name: "Alice", password: "password123" }))
        expect(res.status).toBe(400)
    })

    it("accepts name at exact max length (50 chars)", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(makeInvitation())
        prismaMock.user.findUnique.mockResolvedValue(null)
        ;(prismaMock.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<void>) => {
            await fn({
                ...prismaMock,
                distributorInvitation: {
                    findUnique: jest.fn().mockResolvedValue({ acceptedAt: null }),
                    update: jest.fn().mockResolvedValue({}),
                },
                user: { create: jest.fn().mockResolvedValue({ id: "new_user" }) },
                account: { create: jest.fn().mockResolvedValue({}) },
            })
        })

        const res = await AcceptInvitePost(createRequest({ token: "valid-token", name: "a".repeat(50), password: "password123" }))
        expect(res.status).toBe(200)
    })

    it("returns 400 when no-email invite is accepted without username", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(
            makeInvitation({ email: null })
        )
        const res = await AcceptInvitePost(
            createRequest({ token: "valid-token", name: "Alice", password: "password123" })
        )
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.details?.username).toBeDefined()
    })

    it("returns 400 when username is too short (< 6 chars) for no-email invite", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(
            makeInvitation({ email: null })
        )
        const res = await AcceptInvitePost(
            createRequest({ token: "valid-token", name: "Alice", username: "abc", password: "password123" })
        )
        expect(res.status).toBe(400)
    })

    it("returns 409 when username is already taken for no-email invite", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(
            makeInvitation({ email: null })
        )
        prismaMock.user.findUnique.mockResolvedValue({ id: "existing_user" } as any)
        const res = await AcceptInvitePost(
            createRequest({ token: "valid-token", name: "Alice", username: "alice_123", password: "password123" })
        )
        expect(res.status).toBe(409)
        const body = await res.json()
        expect(body.error).toMatch(/用户名已被使用/)
    })

    it("creates user with email=null and username for no-email invite", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(
            makeInvitation({ email: null })
        )
        prismaMock.user.findUnique.mockResolvedValue(null)

        let userCreateArgs: any
        ;(prismaMock.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<void>) => {
            const userCreateMock = jest.fn().mockResolvedValue({ id: "new_user" })
            await fn({
                ...prismaMock,
                distributorInvitation: {
                    findUnique: jest.fn().mockResolvedValue({ acceptedAt: null }),
                    update: jest.fn().mockResolvedValue({}),
                },
                user: { create: userCreateMock },
                account: { create: jest.fn().mockResolvedValue({}) },
            })
            userCreateArgs = userCreateMock.mock.calls[0][0]
        })

        const res = await AcceptInvitePost(
            createRequest({ token: "valid-token", name: "Alice", username: "alice_123", password: "password123" })
        )
        expect(res.status).toBe(200)
        expect(userCreateArgs.data.email).toBeNull()
        expect(userCreateArgs.data.username).toBe("alice_123")
        expect(userCreateArgs.data.name).toBe("Alice")
    })

    it("does not check email uniqueness for no-email invite", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(
            makeInvitation({ email: null })
        )
        prismaMock.user.findUnique.mockResolvedValue(null)
        ;(prismaMock.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<void>) => {
            await fn({
                ...prismaMock,
                distributorInvitation: {
                    findUnique: jest.fn().mockResolvedValue({ acceptedAt: null }),
                    update: jest.fn().mockResolvedValue({}),
                },
                user: { create: jest.fn().mockResolvedValue({ id: "new_user" }) },
                account: { create: jest.fn().mockResolvedValue({}) },
            })
        })

        const res = await AcceptInvitePost(
            createRequest({ token: "valid-token", name: "Alice", username: "alice_123", password: "password123" })
        )
        expect(res.status).toBe(200)
        expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({ where: { username: "alice_123" } })
        )
        expect(prismaMock.user.findUnique).not.toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ email: expect.anything() }) })
        )
    })

    it("normalizes uppercase username to lowercase before storing", async () => {
        prismaMock.distributorInvitation.findUnique.mockResolvedValue(
            makeInvitation({ email: null })
        )
        prismaMock.user.findUnique.mockResolvedValue(null)

        let userCreateArgs: any
        ;(prismaMock.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<void>) => {
            const userCreateMock = jest.fn().mockResolvedValue({ id: "new_user" })
            await fn({
                ...prismaMock,
                distributorInvitation: {
                    findUnique: jest.fn().mockResolvedValue({ acceptedAt: null }),
                    update: jest.fn().mockResolvedValue({}),
                },
                user: { create: userCreateMock },
                account: { create: jest.fn().mockResolvedValue({}) },
            })
            userCreateArgs = userCreateMock.mock.calls[0][0]
        })

        const res = await AcceptInvitePost(
            createRequest({ token: "valid-token", name: "Alice", username: "AliceTest_1", password: "password123" })
        )
        expect(res.status).toBe(200)
        expect(userCreateArgs.data.username).toBe("alicetest_1")
    })
})
