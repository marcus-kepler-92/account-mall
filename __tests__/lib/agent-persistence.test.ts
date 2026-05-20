import {
  persistUserMessage,
  persistToolStep,
  persistAssistantMessage,
  fetchUserOrdersByHints,
} from "@/lib/agent-persistence"
import { prisma } from "@/lib/prisma"

jest.mock("next/cache", () => ({
  unstable_cache: jest.fn((fn: unknown, key: unknown, opts: unknown) =>
    Object.assign(fn as object, { __cacheKey: key, __cacheOpts: opts }),
  ),
}))

jest.mock("@/lib/prisma", () => ({
  prisma: {
    agentMessage: { create: jest.fn() },
    agentKnowledge: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
    order: { findMany: jest.fn() },
  },
}))

beforeEach(() => jest.clearAllMocks())

describe("persistUserMessage", () => {
  it("creates a USER message with extracted text", async () => {
    const msg = {
      id: "m1",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "hi there" }],
    }
    await persistUserMessage("s1", msg as never)
    expect(prisma.agentMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: "s1",
        role: "USER",
        contentText: "hi there",
      }),
    })
  })

  it("concatenates multiple text parts", async () => {
    const msg = {
      id: "m1",
      role: "user" as const,
      parts: [
        { type: "text" as const, text: "hello " },
        { type: "text" as const, text: "world" },
      ],
    }
    await persistUserMessage("s1", msg as never)
    expect(prisma.agentMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ contentText: "hello world" }),
    })
  })
})

describe("persistToolStep", () => {
  it("creates a TOOL message per toolCall", async () => {
    await persistToolStep("s1", {
      toolCalls: [
        { toolName: "lookupOrder", toolCallId: "t1", input: { orderNo: "OD1" } },
      ],
    } as never)
    expect(prisma.agentMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: "s1",
        role: "TOOL",
        toolName: "lookupOrder",
      }),
    })
  })

  it("no-ops when step has no toolCalls", async () => {
    await persistToolStep("s1", {} as never)
    expect(prisma.agentMessage.create).not.toHaveBeenCalled()
  })
})

describe("persistAssistantMessage", () => {
  it("creates ASSISTANT row with usage tokens + citations", async () => {
    const msgs = [
      {
        role: "assistant",
        content: [{ type: "text", text: "hello" }],
      },
    ]
    await persistAssistantMessage(
      "s1",
      msgs as never,
      { promptTokens: 100, completionTokens: 50 },
      ["k1", "k2"],
    )
    expect(prisma.agentMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: "ASSISTANT",
        contentText: "hello",
        inputTokens: 100,
        outputTokens: 50,
        citations: ["k1", "k2"],
      }),
    })
  })

  it("skips citations field when none provided", async () => {
    await persistAssistantMessage(
      "s1",
      [{ role: "assistant", content: [{ type: "text", text: "ok" }] }] as never,
      { promptTokens: 10, completionTokens: 5 },
    )
    const call = (prisma.agentMessage.create as jest.Mock).mock.calls[0][0]
    expect(call.data.citations).toBeUndefined()
  })

  it("returns early when no assistant message in response", async () => {
    await persistAssistantMessage(
      "s1",
      [{ role: "user", content: [{ type: "text", text: "hi" }] }] as never,
      {},
    )
    expect(prisma.agentMessage.create).not.toHaveBeenCalled()
  })
})

describe("fetchPublishedKnowledge cache contract", () => {
  it("registers cache key 'agent-knowledge-published' and tag 'agent-knowledge'", () => {
    // The unstable_cache mock attaches metadata to the cached function
    const fetched = require("@/lib/agent-persistence")
      .fetchPublishedKnowledge as { __cacheKey: string[]; __cacheOpts: { revalidate: number; tags: string[] } }
    expect(fetched.__cacheKey).toEqual(["agent-knowledge-published"])
    expect(fetched.__cacheOpts.tags).toEqual(["agent-knowledge"])
    expect(fetched.__cacheOpts.revalidate).toBe(3600)
  })
})

describe("fetchActiveProducts cache contract", () => {
  it("registers cache key 'agent-active-products' and tags include 'products'", () => {
    // Tag 'products' is shared with revalidate-storefront so admin product writes
    // already invalidate the agent's product index without extra wiring.
    const fetched = require("@/lib/agent-persistence")
      .fetchActiveProducts as { __cacheKey: string[]; __cacheOpts: { revalidate: number; tags: string[] } }
    expect(fetched.__cacheKey).toEqual(["agent-active-products"])
    expect(fetched.__cacheOpts.tags).toEqual(
      expect.arrayContaining(["products", "agent-active-products"]),
    )
    expect(fetched.__cacheOpts.revalidate).toBe(600)
  })
})

describe("fetchUserOrdersByHints — security & robustness", () => {
  const findMany = prisma.order.findMany as jest.Mock

  it("returns empty when hints is undefined or empty", async () => {
    expect(await fetchUserOrdersByHints(undefined)).toEqual([])
    expect(await fetchUserOrdersByHints([])).toEqual([])
    expect(findMany).not.toHaveBeenCalled()
  })

  it("only returns orders that actually exist (drops fabricated hints)", async () => {
    findMany.mockResolvedValueOnce([
      {
        orderNo: "REAL-001",
        status: "COMPLETED",
        productNameSnapshot: "共享号",
        paidAt: new Date("2026-05-18T00:00:00Z"),
      },
    ])
    const r = await fetchUserOrdersByHints(["REAL-001", "FAKE-XYZ-123", "REAL-002"])
    expect(r).toHaveLength(1)
    expect(r[0].orderNo).toBe("REAL-001")
  })

  it("caps the number of hints at 5 to bound prompt size", async () => {
    findMany.mockResolvedValueOnce([])
    const many = Array.from({ length: 20 }, (_, i) => `OD-${i.toString().padStart(6, "0")}`)
    await fetchUserOrdersByHints(many)
    const call = findMany.mock.calls[0][0]
    expect(call.where.orderNo.in).toHaveLength(5)
  })

  it("deduplicates repeated hints before querying", async () => {
    findMany.mockResolvedValueOnce([])
    await fetchUserOrdersByHints(["DUP-001", "DUP-001", "DUP-001", "OTHER-002"])
    const call = findMany.mock.calls[0][0]
    expect(call.where.orderNo.in.sort()).toEqual(["DUP-001", "OTHER-002"])
  })

  it("filters out hints with invalid length", async () => {
    findMany.mockResolvedValueOnce([])
    await fetchUserOrdersByHints(["short", "OK-ENOUGH-1234", "a".repeat(41)])
    const call = findMany.mock.calls[0][0]
    expect(call.where.orderNo.in).toEqual(["OK-ENOUGH-1234"])
  })

  it("ignores non-string entries defensively", async () => {
    findMany.mockResolvedValueOnce([])
    await fetchUserOrdersByHints([
      "GOOD-12345",
      null as unknown as string,
      undefined as unknown as string,
      12345 as unknown as string,
      { hax: true } as unknown as string,
    ])
    const call = findMany.mock.calls[0][0]
    expect(call.where.orderNo.in).toEqual(["GOOD-12345"])
  })

  it("returns a safe subset only (no card, email, or token fields)", async () => {
    findMany.mockResolvedValueOnce([
      {
        orderNo: "OD-SAFE",
        status: "COMPLETED",
        productNameSnapshot: "共享号",
        paidAt: new Date("2026-05-18T00:00:00Z"),
      },
    ])
    const r = await fetchUserOrdersByHints(["OD-SAFE"])
    expect(Object.keys(r[0]).sort()).toEqual(["orderNo", "paidAt", "product", "status"])
    expect(JSON.stringify(r)).not.toMatch(/email|token|card|password/i)
  })

  it("formats paidAt as YYYY-MM-DD and passes through null", async () => {
    findMany.mockResolvedValueOnce([
      {
        orderNo: "OD-PAID",
        status: "COMPLETED",
        productNameSnapshot: "X",
        paidAt: new Date("2026-05-18T12:34:56Z"),
      },
      {
        orderNo: "OD-PENDING",
        status: "PENDING",
        productNameSnapshot: "Y",
        paidAt: null,
      },
    ])
    const r = await fetchUserOrdersByHints(["OD-PAID", "OD-PENDING"])
    expect(r[0].paidAt).toBe("2026-05-18")
    expect(r[1].paidAt).toBeNull()
  })
})
