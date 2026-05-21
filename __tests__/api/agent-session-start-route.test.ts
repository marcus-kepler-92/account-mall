/**
 * Test: POST /api/agent/session/start — BotID gating per VERCEL_ENV.
 *
 * Why this file exists:
 *   The route previously called `checkBotId()` unconditionally on every
 *   request. On Vercel preview deployments the client-side <BotIdClient>
 *   isn't mounted (we gate it on VERCEL_ENV === "production" in app/layout
 *   to avoid noisy 404s loading /_vercel/botid/...). With no client token,
 *   server-side checkBotId() classifies the request as a bot and returns
 *   403 — completely breaking the chat widget on preview.
 *
 *   Fix: mirror the layout gate here. Production runs the BotID check,
 *   preview / development skip it. These tests pin that contract.
 */
import { type NextRequest } from "next/server"

jest.mock("botid/server", () => ({
    __esModule: true,
    checkBotId: jest.fn(),
}))

jest.mock("@/lib/prisma", () => ({
    prisma: {
        agentSession: {
            findUnique: jest.fn(),
            create: jest.fn(),
        },
    },
}))

jest.mock("@/lib/agent-anti-abuse", () => ({
    fingerprint: jest.fn().mockReturnValue("fp-stub"),
}))

// Override the global jest.setup site-settings stub for tighter assertions.
jest.mock("@/lib/site-settings", () => ({
    getSiteSettings: jest.fn().mockResolvedValue({
        wechatQrUrl: "https://blob.example/qr.png",
        wechatId: "void_support",
        businessHoursStart: 9,
        businessHoursEnd: 22,
        businessHoursTimezone: "Asia/Shanghai",
        businessName: "",
        businessLicenseNo: "",
        contactEmail: "",
        escalateWebhookUrl: undefined,
    }),
    getSiteSettingRow: jest.fn().mockResolvedValue(null),
}))

import { POST } from "@/app/api/agent/session/start/route"
import { checkBotId } from "botid/server"
import { prisma } from "@/lib/prisma"

const checkBotIdMock = checkBotId as jest.Mock
const findUniqueMock = prisma.agentSession.findUnique as jest.Mock
const createMock = prisma.agentSession.create as jest.Mock

const VALID_SESSION_ID = "01HXXXXXXXXXXXXXXXXXXXXXXX" // ULID-ish, 26 chars, passes z.string().min(20).max(40)

function buildRequest(body: unknown): NextRequest {
    return {
        json: () => Promise.resolve(body),
    } as unknown as NextRequest
}

const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV

afterAll(() => {
    if (ORIGINAL_VERCEL_ENV === undefined) {
        delete process.env.VERCEL_ENV
    } else {
        process.env.VERCEL_ENV = ORIGINAL_VERCEL_ENV
    }
})

beforeEach(() => {
    jest.clearAllMocks()
    findUniqueMock.mockResolvedValue(null)
    createMock.mockImplementation(({ data }) =>
        Promise.resolve({ id: data.id, tokenBudget: data.tokenBudget, tokensUsed: 0 }),
    )
})

describe("session/start — BotID is fully disabled (custom domain incompatibility)", () => {
    // Vercel BotID's /_vercel/botid/... script isn't provisioned on
    // custom domains (only on vercel.app). The client SDK 404s and enters
    // an infinite retry loop that freezes the tab. Both the client mount
    // (app/layout.tsx) and the server-side check are off until BotID
    // supports custom domains. These tests pin "off" so a partial revert
    // can't reintroduce the 403 / browser-freeze regression.

    it("never invokes checkBotId, regardless of VERCEL_ENV", async () => {
        for (const env of ["production", "preview", undefined]) {
            if (env === undefined) delete process.env.VERCEL_ENV
            else process.env.VERCEL_ENV = env
            checkBotIdMock.mockClear()
            const res = await POST(buildRequest({ sessionId: VALID_SESSION_ID }))
            expect(res.status).toBe(200)
            expect(checkBotIdMock).not.toHaveBeenCalled()
        }
    })

    it("does not import botid/server at all (so a future re-enable is a deliberate change)", () => {
        // Read the route source and assert no checkBotId import. If somebody
        // brings BotID back without updating this test, CI will flag.
        const fs = require("fs") as typeof import("fs")
        const path = require("path") as typeof import("path")
        const source = fs.readFileSync(
            path.join(__dirname, "../../app/api/agent/session/start/route.ts"),
            "utf8",
        )
        expect(source).not.toMatch(/from\s+["']botid\/server["']/)
        expect(source).not.toMatch(/checkBotId\s*\(/)
    })
})

describe("session/start — body validation", () => {
    it("rejects missing sessionId with 400", async () => {
        process.env.VERCEL_ENV = "preview"
        const res = await POST(buildRequest({}))
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error).toBe("bad-request")
    })

    it("rejects sessionId shorter than 20 chars with 400", async () => {
        process.env.VERCEL_ENV = "preview"
        const res = await POST(buildRequest({ sessionId: "short" }))
        expect(res.status).toBe(400)
    })
})

describe("session/start — idempotency", () => {
    it("returns existing session when one already exists for this id", async () => {
        process.env.VERCEL_ENV = "preview"
        findUniqueMock.mockResolvedValueOnce({
            id: VALID_SESSION_ID,
            tokenBudget: 50_000,
            tokensUsed: 1234,
        })
        const res = await POST(buildRequest({ sessionId: VALID_SESSION_ID }))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.sessionId).toBe(VALID_SESSION_ID)
        expect(body.tokensUsed).toBe(1234)
        expect(prisma.agentSession.create).not.toHaveBeenCalled()
    })

    it("creates a new session row when id is new", async () => {
        process.env.VERCEL_ENV = "preview"
        findUniqueMock.mockResolvedValueOnce(null)
        const res = await POST(buildRequest({ sessionId: VALID_SESSION_ID }))
        expect(res.status).toBe(200)
        expect(prisma.agentSession.create).toHaveBeenCalledTimes(1)
        const createArgs = createMock.mock.calls[0][0]
        expect(createArgs.data).toMatchObject({
            id: VALID_SESSION_ID,
            fingerprintHash: "fp-stub",
        })
    })
})

describe("session/start — handoff payload (drives FallbackQR / HandoffCard)", () => {
    it("returns wechat QR + id resolved from SiteSetting (DB→env), not /contact-qr.png", async () => {
        // Regression: FallbackQR + HandoffCard used to hard-code
        //   <Image src="/contact-qr.png" />
        // so admin uploads to SiteSetting never reached the chat widget.
        // We now ship the resolved values down on session/start.
        process.env.VERCEL_ENV = "preview"
        const res = await POST(buildRequest({ sessionId: VALID_SESSION_ID }))
        const body = await res.json()
        expect(body.handoff).toEqual({
            qrUrl: "https://blob.example/qr.png",
            wechatId: "void_support",
        })
    })

    it("includes handoff on the existing-session branch too", async () => {
        process.env.VERCEL_ENV = "preview"
        findUniqueMock.mockResolvedValueOnce({
            id: VALID_SESSION_ID,
            tokenBudget: 50_000,
            tokensUsed: 0,
        })
        const res = await POST(buildRequest({ sessionId: VALID_SESSION_ID }))
        const body = await res.json()
        expect(body.handoff).toEqual({
            qrUrl: "https://blob.example/qr.png",
            wechatId: "void_support",
        })
    })
})
