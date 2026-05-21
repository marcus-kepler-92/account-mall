import {
  reserveTokens,
  commitUsage,
  rollbackTokens,
  estimateTokens,
  fingerprint,
  applyAntiAbuse,
} from "@/lib/agent-anti-abuse"
import { redis, limiters as mockLimiters } from "@/lib/agent-rate-limit"
import { prisma, prisma as mockPrisma } from "@/lib/prisma"

jest.mock("@/lib/agent-rate-limit", () => {
  const pipe = {
    incrby: jest.fn().mockReturnThis(),
    decrby: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  }
  return {
    redis: { pipeline: jest.fn(() => pipe), __pipe: pipe },
    limiters: {
      chatIp: { limit: jest.fn().mockResolvedValue({ success: true }) },
      chatSession: { limit: jest.fn().mockResolvedValue({ success: true }) },
      chatFp: { limit: jest.fn().mockResolvedValue({ success: true }) },
      csReverse: { limit: jest.fn().mockResolvedValue({ success: true }) },
    },
  }
})

jest.mock("@/lib/prisma", () => ({
  prisma: {
    agentSession: { findUnique: jest.fn(), update: jest.fn() },
  },
}))

const pipe = (redis as unknown as { __pipe: {
  incrby: jest.Mock
  decrby: jest.Mock
  exec: jest.Mock
} }).__pipe

beforeEach(() => jest.clearAllMocks())

describe("estimateTokens", () => {
  it("returns input + 500 output minimum", () => {
    const r = estimateTokens([])
    expect(r.output).toBe(500)
    expect(r.input).toBeGreaterThanOrEqual(500)
  })
})

describe("fingerprint", () => {
  it("returns stable 32-char hex hash", () => {
    const req = new Request("http://x.test", {
      headers: { "x-forwarded-for": "1.2.3.4", "user-agent": "TestBot/1.0" },
    })
    const fp = fingerprint(req)
    expect(fp).toMatch(/^[0-9a-f]{32}$/)
    expect(fingerprint(req)).toBe(fp)
  })
  it("differs across IP/UA", () => {
    const a = new Request("http://x.test", { headers: { "x-forwarded-for": "1.2.3.4", "user-agent": "A" } })
    const b = new Request("http://x.test", { headers: { "x-forwarded-for": "5.6.7.8", "user-agent": "A" } })
    expect(fingerprint(a)).not.toBe(fingerprint(b))
  })
})

describe("reserveTokens", () => {
  it("returns ok when under cap", async () => {
    pipe.exec.mockResolvedValueOnce([100, 50, 150])
    const r = await reserveTokens("s1", { input: 100, output: 50 })
    expect(r.ok).toBe(true)
    expect(pipe.incrby).toHaveBeenCalledTimes(3)
  })

  it("returns daily-cap when input over cap and rolls back", async () => {
    pipe.exec.mockResolvedValueOnce([5_000_000, 50, 5_000_050])
    pipe.exec.mockResolvedValueOnce([0, 0, 0])  // rollback exec
    const r = await reserveTokens("s1", { input: 5_000_000, output: 50 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("daily-cap")
    expect(pipe.decrby).toHaveBeenCalledTimes(3)
  })
})

describe("commitUsage", () => {
  it("increments diff and updates AgentSession.tokensUsed", async () => {
    pipe.exec.mockResolvedValueOnce([])
    await commitUsage("s1", { input: 100, output: 50 }, { promptTokens: 120, completionTokens: 80 })
    expect(pipe.incrby).toHaveBeenCalled()
    expect(prisma.agentSession.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { tokensUsed: { increment: 200 } },
    })
  })
})

describe("rollbackTokens", () => {
  it("decrements all three counters", async () => {
    pipe.exec.mockResolvedValueOnce([])
    await rollbackTokens("s1", { input: 100, output: 50 })
    expect(pipe.decrby).toHaveBeenCalledTimes(3)
  })
})

function makeReq(body: string, ip = "1.2.3.4"): Request {
  return new Request("http://x.test/api/agent/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      "user-agent": "TestUA/1.0",
    },
    body,
  })
}

function userMsg(text: string) {
  return { id: "u1", role: "user" as const, parts: [{ type: "text" as const, text }] }
}

const validSession = {
  id: "s1",
  fingerprintHash: "abc123def456abc123def456abc12345",
  tokenBudget: 2000,
  tokensUsed: 0,
  expiresAt: new Date(Date.now() + 86_400_000),
  escalated: false,
  startedAt: new Date(),
  endedAt: null,
}

describe("applyAntiAbuse", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockPrisma.agentSession.findUnique as jest.Mock).mockResolvedValue(validSession)
  })

  it("returns 400 when last user message exceeds 4 KB", async () => {
    const huge = "a".repeat(4096 + 1)
    const req = makeReq("{}")
    const result = await applyAntiAbuse(req, "s1", [userMsg(huge)])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(400)
  })

  it("returns 410 when session does not exist", async () => {
    ;(mockPrisma.agentSession.findUnique as jest.Mock).mockResolvedValueOnce(null)
    const result = await applyAntiAbuse(makeReq("{}"), "missing", [userMsg("hi")])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(410)
  })

  it("returns 410 when session is expired", async () => {
    ;(mockPrisma.agentSession.findUnique as jest.Mock).mockResolvedValueOnce({
      ...validSession,
      expiresAt: new Date(Date.now() - 1000),
    })
    const result = await applyAntiAbuse(makeReq("{}"), "s1", [userMsg("hi")])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(410)
  })

  it("returns 423 when tokenBudget is exhausted", async () => {
    ;(mockPrisma.agentSession.findUnique as jest.Mock).mockResolvedValueOnce({
      ...validSession,
      tokensUsed: 2000,
      tokenBudget: 2000,
    })
    const result = await applyAntiAbuse(makeReq("{}"), "s1", [userMsg("hi")])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(423)
  })

  it("bypasses the per-session budget cap when NODE_ENV=development (local dev only)", async () => {
    const original = process.env.NODE_ENV
    // @ts-expect-error — readonly in @types/node but jest lets us mutate
    process.env.NODE_ENV = "development"
    try {
      ;(mockPrisma.agentSession.findUnique as jest.Mock).mockResolvedValueOnce({
        ...validSession,
        tokensUsed: 2000,
        tokenBudget: 2000,
      })
      const result = await applyAntiAbuse(makeReq("{}"), "s1", [userMsg("hi")])
      // Budget would normally trip 423 here; dev bypass lets it through.
      expect(result.ok).toBe(true)
    } finally {
      // @ts-expect-error — restore
      process.env.NODE_ENV = original
    }
  })

  it("returns 429 when any limiter fails", async () => {
    ;(mockLimiters!.chatIp.limit as jest.Mock).mockResolvedValueOnce({ success: false })
    const result = await applyAntiAbuse(makeReq("{}"), "s1", [userMsg("hi")])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(429)
  })

  it("returns ok with fingerprintHash + fallbackResponse closure when all checks pass", async () => {
    const result = await applyAntiAbuse(makeReq("{}"), "s1", [userMsg("hi")])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.fingerprintHash).toBe(validSession.fingerprintHash)
      expect(typeof result.fallbackResponse).toBe("function")
      const fb = result.fallbackResponse("daily-cap")
      expect(fb.status).toBe(503)
    }
  })
})
