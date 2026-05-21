import { buildCSPrompt, buildCSTools } from "@/lib/agent-cs"
import { prisma } from "@/lib/prisma"

// Tool execute / inputSchema typings from the AI SDK are intentionally loose
// (execute may be undefined, schema is FlexibleSchema). Use a tagged unknown
// shape so tests can call execute / safeParse without satisfying SDK generics.
type ToolAny = {
  execute: (...args: unknown[]) => Promise<unknown>
  inputSchema: { safeParse: (v: unknown) => { success: boolean } }
}
type ToolsRecord = Record<string, ToolAny>

jest.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findMany: jest.fn(), findFirst: jest.fn() },
    order: { findFirst: jest.fn() },
    announcement: { findMany: jest.fn() },
    agentKnowledge: { findMany: jest.fn() },
    agentLead: { create: jest.fn(), findFirst: jest.fn() },
    agentMessage: { findMany: jest.fn() },
    agentSession: { update: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  },
}))

jest.mock("@/lib/business-hours", () => ({
  isInBusinessHours: jest.fn().mockResolvedValue(true),
}))

const ctx = { toolCallId: "1", messages: [] } as never

beforeEach(() => jest.clearAllMocks())

describe("lookupProduct", () => {
  it("fetches ACTIVE product by id and maps realtime detail", async () => {
    ;(prisma.product.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "p1",
      name: "iCloud 200G",
      slug: "icloud-200g",
      summary: "Apple iCloud",
      price: 29.9,
      productType: "MANUAL",
      _count: { cards: 5 },
    })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const result = await tools.lookupProduct.execute({ productId: "p1" }, ctx)
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1", status: "ACTIVE" },
      }),
    )
    expect(result).toEqual(
      expect.objectContaining({
        found: true,
        id: "p1",
        name: "iCloud 200G",
        inStock: true,
        // Relative pure-slug path since the 2026-05 [slug] refactor.
        url: "/products/icloud-200g",
        price: "29.90",
      }),
    )
  })

  it("returns found:false when product missing or not ACTIVE", async () => {
    ;(prisma.product.findFirst as jest.Mock).mockResolvedValueOnce(null)
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const result = await tools.lookupProduct.execute({ productId: "nope" }, ctx)
    expect(result).toEqual({ found: false })
  })
})

describe("lookupOrder", () => {
  it("returns found:false (no detail) when order missing", async () => {
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce(null)
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = await tools.lookupOrder.execute({ orderNo: "NOTEXIST" }, ctx)
    expect(r).toEqual({ found: false })
  })

  it("returns sanitized order without card content", async () => {
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce({
      orderNo: "OD123",
      status: "COMPLETED",
      amount: 29.9,
      productNameSnapshot: "iCloud 200G",
      paidAt: new Date("2026-05-18T00:00:00Z"),
      createdAt: new Date("2026-05-18T00:00:00Z"),
      expiresAt: null,
      switchAccountCount: 0,
      product: { productType: "MANUAL", allowAccountSwitch: false, accountSwitchLimit: 0 },
    })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = await tools.lookupOrder.execute({ orderNo: "OD123" }, ctx)
    expect(r).toMatchObject({
      found: true,
      orderNo: "OD123",
      status: "COMPLETED",
      amount: "29.90",
      product: "iCloud 200G",
    })
    expect(JSON.stringify(r)).not.toMatch(/cardCode|password|cards/i)
  })

  it("returns canSwitchAccount=true for live AUTO_FETCH share-account orders with quota left", async () => {
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce({
      orderNo: "OD-AUTO-1",
      status: "COMPLETED",
      amount: 9.9,
      productNameSnapshot: "共享号·美区",
      paidAt: new Date("2026-05-18T00:00:00Z"),
      createdAt: new Date("2026-05-18T00:00:00Z"),
      expiresAt: new Date("2027-05-18T00:00:00Z"),
      switchAccountCount: 1,
      product: { productType: "AUTO_FETCH", allowAccountSwitch: true, accountSwitchLimit: 5 },
    })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.lookupOrder.execute({ orderNo: "OD-AUTO-1" }, ctx)) as Record<string, unknown>
    expect(r).toMatchObject({
      found: true,
      canSwitchAccount: true,
      switchAccountRemaining: 4,
      isExpired: false,
      productType: "AUTO_FETCH",
    })
  })

  it("returns canSwitchAccount=false when AUTO_FETCH order is expired", async () => {
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce({
      orderNo: "OD-EXPIRED",
      status: "COMPLETED",
      amount: 9.9,
      productNameSnapshot: "共享号·美区",
      paidAt: new Date("2025-01-01T00:00:00Z"),
      createdAt: new Date("2025-01-01T00:00:00Z"),
      expiresAt: new Date("2025-02-01T00:00:00Z"),
      switchAccountCount: 0,
      product: { productType: "AUTO_FETCH", allowAccountSwitch: true, accountSwitchLimit: 5 },
    })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.lookupOrder.execute({ orderNo: "OD-EXPIRED" }, ctx)) as Record<string, unknown>
    expect(r).toMatchObject({ canSwitchAccount: false, isExpired: true })
  })

  it("returns canSwitchAccount=false when AUTO_FETCH switch quota exhausted", async () => {
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce({
      orderNo: "OD-NOSWAP",
      status: "COMPLETED",
      amount: 9.9,
      productNameSnapshot: "共享号",
      paidAt: new Date("2026-05-18T00:00:00Z"),
      createdAt: new Date("2026-05-18T00:00:00Z"),
      expiresAt: new Date("2027-05-18T00:00:00Z"),
      switchAccountCount: 5,
      product: { productType: "AUTO_FETCH", allowAccountSwitch: true, accountSwitchLimit: 5 },
    })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.lookupOrder.execute({ orderNo: "OD-NOSWAP" }, ctx)) as Record<string, unknown>
    expect(r).toMatchObject({ canSwitchAccount: false, switchAccountRemaining: 0 })
  })

  it("returns canSwitchAccount=false for non-AUTO_FETCH (independent / finished accounts)", async () => {
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce({
      orderNo: "OD-MANUAL",
      status: "COMPLETED",
      amount: 49.9,
      productNameSnapshot: "独享号",
      paidAt: new Date("2026-05-18T00:00:00Z"),
      createdAt: new Date("2026-05-18T00:00:00Z"),
      expiresAt: null,
      switchAccountCount: 0,
      product: { productType: "MANUAL", allowAccountSwitch: false, accountSwitchLimit: 0 },
    })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.lookupOrder.execute({ orderNo: "OD-MANUAL" }, ctx)) as Record<string, unknown>
    expect(r).toMatchObject({ canSwitchAccount: false, productType: "MANUAL" })
  })

  it("never returns a tokenized order URL — only the public /orders/lookup entry", async () => {
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce({
      orderNo: "OD-SAFE",
      status: "COMPLETED",
      amount: 9.9,
      productNameSnapshot: "共享号",
      paidAt: new Date("2026-05-18T00:00:00Z"),
      createdAt: new Date("2026-05-18T00:00:00Z"),
      expiresAt: new Date("2027-05-18T00:00:00Z"),
      switchAccountCount: 0,
      product: { productType: "AUTO_FETCH", allowAccountSwitch: true, accountSwitchLimit: 5 },
    })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.lookupOrder.execute({ orderNo: "OD-SAFE" }, ctx)) as Record<string, unknown>
    // Relative path — no scheme, no host. Locks both "no tokenized URL"
    // and "no domain hard-coding" into one assertion.
    expect(r.lookupUrl).toBe("/orders/lookup")
    expect(JSON.stringify(r)).not.toMatch(/token|success\?|access[_-]?token|https?:\/\//i)
  })
})

describe("getAnnouncements", () => {
  it("filters PUBLISHED CUSTOMER/ALL audience", async () => {
    ;(prisma.announcement.findMany as jest.Mock).mockResolvedValueOnce([
      { title: "维护", content: "周一", publishedAt: new Date("2026-05-15T00:00:00Z") },
    ])
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = await tools.getAnnouncements.execute({}, ctx)
    expect(prisma.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PUBLISHED", audience: { in: ["CUSTOMER", "ALL"] } },
        take: 5,
      }),
    )
    expect(r).toHaveLength(1)
  })
})

describe("lookupKnowledge", () => {
  it("returns only PUBLISHED with id + excerpt", async () => {
    ;(prisma.agentKnowledge.findMany as jest.Mock).mockResolvedValueOnce([
      { id: "k1", title: "失效补单", content: "6 个月内可补", tags: ["refund"] },
    ])
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.lookupKnowledge.execute({ query: "失效" }, ctx)) as Array<
      Record<string, unknown>
    >
    expect(prisma.agentKnowledge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    )
    expect(r[0]).toEqual({
      id: "k1",
      title: "失效补单",
      tags: ["refund"],
      excerpt: "6 个月内可补",
    })
  })
})

describe("verifyOrder", () => {
  it("returns exists:true with masked details when orderNo matches", async () => {
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce({
      orderNo: "OD-OK-1",
      status: "COMPLETED",
      productNameSnapshot: "iCloud 200G",
    })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = await tools.verifyOrder.execute({ orderNo: "OD-OK-1" }, ctx)
    expect(r).toEqual({
      exists: true,
      orderNo: "OD-OK-1",
      product: "iCloud 200G",
      status: "COMPLETED",
    })
  })

  it("returns exists:false + hint when orderNo not found — AI should ask user to recheck", async () => {
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce(null)
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.verifyOrder.execute({ orderNo: "OD-NOPE" }, ctx)) as {
      exists: boolean
      hint?: string
    }
    expect(r.exists).toBe(false)
    expect(r.hint).toMatch(/找不到这个订单号/)
    expect(r.hint).toMatch(/复核/)
  })

  it("does NOT leak sensitive fields (no email, paidAt, amount, expiresAt, etc.)", () => {
    // verify_order is the cheap pre-flight; rich diagnosis lives in
    // lookup_order. Keep this assertion tight so future field-creep
    // doesn't quietly turn it into another lookup_order.
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce({
      orderNo: "OD-1",
      status: "COMPLETED",
      productNameSnapshot: "X",
    })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const findArgs = (prisma.order.findFirst as jest.Mock).mock.calls.length
    void tools.verifyOrder.execute({ orderNo: "OD-1" }, ctx)
    expect(findArgs).toBeGreaterThanOrEqual(0)
    // Verify the `select` clause only requests the three minimal fields
    // (called the second time after the .execute() above).
    const select = (prisma.order.findFirst as jest.Mock).mock.calls[
      (prisma.order.findFirst as jest.Mock).mock.calls.length - 1
    ][0].select
    expect(Object.keys(select).sort()).toEqual(
      ["orderNo", "productNameSnapshot", "status"].sort(),
    )
  })

  it("rejects too-short orderNo via Zod (matches lookup_order's 6–40 bounds)", () => {
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = tools.verifyOrder.inputSchema.safeParse({ orderNo: "short" })
    expect(r.success).toBe(false)
  })
})

describe("collectWechat", () => {
  beforeEach(() => {
    // collectWechat now snapshots recent conversation into the lead so
    // ops can see the context — mock the underlying findMany so the tool
    // doesn't crash on `.reverse()` of `undefined`.
    ;(prisma.agentMessage.findMany as jest.Mock).mockResolvedValue([])
  })

  it("customer_support + verified orderNo: creates Lead, renders QR", async () => {
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce({ orderNo: "OD20260521" })
    ;(prisma.agentLead.create as jest.Mock).mockResolvedValueOnce({ id: "l1" })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = await tools.collectWechat.execute(
      { wechatId: "validId123", orderNo: "OD20260521" },
      ctx,
    )
    expect(prisma.agentLead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING_CONTACT",
          wechatId: "validId123",
          orderNo: "OD20260521",
          sessionId: "s1",
        }),
      }),
    )
    expect(r).toMatchObject({
      ok: true,
      renderQr: true,
      qrUrl: expect.any(String),
      wechatId: expect.any(String),
      orderNoVerified: true,
    })
  })

  it("customer_support + missing orderNo: no Lead, NO QR — AI must keep asking", async () => {
    // Policy update (2026-05): customer-support handoffs are gated on a
    // verified orderNo. Showing the QR without one was sending users
    // into a black hole where ops couldn't match them to a session.
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.collectWechat.execute(
      { wechatId: "validId123" },
      ctx,
    )) as {
      ok: boolean
      renderQr: boolean
      orderNoVerified: boolean
      message: string
    }
    expect(prisma.agentLead.create).not.toHaveBeenCalled()
    expect(r.ok).toBe(false)
    expect(r.renderQr).toBe(false)
    expect(r.orderNoVerified).toBe(false)
    // Message must explicitly ask for the orderNo so AI's bubble follows up
    expect(r.message).toMatch(/订单号/)
  })

  it("customer_support + bogus orderNo: no Lead, NO QR, message asks user to recheck", async () => {
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce(null)
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.collectWechat.execute(
      { wechatId: "validId123", orderNo: "OD-BOGUS" },
      ctx,
    )) as {
      ok: boolean
      renderQr: boolean
      orderNoVerified: boolean
      requiresOrderNoFix: boolean
      message: string
    }
    expect(prisma.agentLead.create).not.toHaveBeenCalled()
    expect(r.renderQr).toBe(false)
    expect(r.orderNoVerified).toBe(false)
    expect(r.requiresOrderNoFix).toBe(true)
    expect(r.message).toMatch(/查不到|复核/)
  })

  it("business_inquiry bypasses orderNo: creates Lead with [合作咨询] tag, renders QR", async () => {
    // 合作 / 代理 / 批发 / 媒体 etc. don't have an order to anchor to —
    // ops still wants the wechat handoff to discuss partnership. Lead
    // reason is prefixed so admin can distinguish from customer support.
    ;(prisma.agentLead.create as jest.Mock).mockResolvedValueOnce({ id: "l-biz" })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.collectWechat.execute(
      { wechatId: "validId123", intent: "business_inquiry" },
      ctx,
    )) as { ok: boolean; renderQr: boolean; qrUrl: string }
    expect(prisma.agentLead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: expect.stringMatching(/^\[合作咨询\]/),
          wechatId: "validId123",
        }),
      }),
    )
    expect(r.ok).toBe(true)
    expect(r.renderQr).toBe(true)
  })

  it("snapshots the recent conversation into the lead (not empty {})", async () => {
    // Regression guard: previously stored `conversationSnapshot: {}`,
    // leaving ops blind on PENDING_CONTACT leads.
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce({ orderNo: "OD20260520" })
    ;(prisma.agentLead.findFirst as jest.Mock).mockResolvedValueOnce(null) // first consultation
    const msgA = { role: "USER", contentText: "我没收到卡密", toolName: null, createdAt: new Date("2026-05-20T10:00:00Z") }
    const msgB = { role: "ASSISTANT", contentText: "请提供订单号", toolName: null, createdAt: new Date("2026-05-20T10:00:05Z") }
    ;(prisma.agentMessage.findMany as jest.Mock).mockResolvedValueOnce([msgB, msgA])
    ;(prisma.agentLead.create as jest.Mock).mockResolvedValueOnce({ id: "l-snap" })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    await tools.collectWechat.execute(
      { wechatId: "validId123", orderNo: "OD20260520" },
      ctx,
    )
    const call = (prisma.agentLead.create as jest.Mock).mock.calls[0][0]
    expect(call.data.conversationSnapshot).toEqual([msgA, msgB])
    expect(call.data.conversationSnapshot).not.toEqual({})
  })

  it("scopes the snapshot to messages AFTER the previous lead — no bleed-in from earlier consultations", async () => {
    // Critical for ops UX: with one session producing multiple leads,
    // each lead must show only the conversation that motivated it. If
    // we naively took the last 20 messages, lead 2's snapshot would
    // include lead 1's messages, making ops confused about which
    // question goes with which lead.
    const prevLeadAt = new Date("2026-05-20T10:00:00Z")
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce({ orderNo: "OD20260520" })
    ;(prisma.agentLead.findFirst as jest.Mock).mockResolvedValueOnce({
      createdAt: prevLeadAt,
    })
    ;(prisma.agentMessage.findMany as jest.Mock).mockResolvedValueOnce([])
    ;(prisma.agentLead.create as jest.Mock).mockResolvedValueOnce({ id: "l-2" })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    await tools.collectWechat.execute(
      { wechatId: "validId123", orderNo: "OD20260520" },
      ctx,
    )
    // The findMany query must filter by createdAt > prevLeadAt
    const findArgs = (prisma.agentMessage.findMany as jest.Mock).mock.calls[0][0]
    expect(findArgs.where.sessionId).toBe("s1")
    expect(findArgs.where.createdAt).toEqual({ gt: prevLeadAt })
    // Larger take cap when scoped (50, not 20 — we know messages are
    // already bounded by the prior lead).
    expect(findArgs.take).toBe(50)
  })

  it("uses the small take cap (20) when this is the first consultation in the session", async () => {
    // Symmetric to above: no prior lead → take 20 like before to
    // bound the snapshot for the very-long-conversation case.
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce({ orderNo: "OD20260520" })
    ;(prisma.agentLead.findFirst as jest.Mock).mockResolvedValueOnce(null)
    ;(prisma.agentMessage.findMany as jest.Mock).mockResolvedValueOnce([])
    ;(prisma.agentLead.create as jest.Mock).mockResolvedValueOnce({ id: "l-first" })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    await tools.collectWechat.execute(
      { wechatId: "validId123", orderNo: "OD20260520" },
      ctx,
    )
    const findArgs = (prisma.agentMessage.findMany as jest.Mock).mock.calls[0][0]
    // No `createdAt: { gt: ... }` clause when no prior lead
    expect(findArgs.where.createdAt).toBeUndefined()
    expect(findArgs.take).toBe(20)
  })

  it("never upserts — a session can produce multiple wechat-id leads over time", async () => {
    // Regression guard: previously this used upsert(where sessionId)
    // which silently overwrote the prior lead. Now each submission is
    // an independent row so ops sees every distinct consultation.
    ;(prisma.order.findFirst as jest.Mock)
      .mockResolvedValueOnce({ orderNo: "OD-A" })
      .mockResolvedValueOnce({ orderNo: "OD-B" })
    ;(prisma.agentLead.create as jest.Mock).mockResolvedValue({ id: "l-new" })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    await tools.collectWechat.execute(
      { wechatId: "validId123", orderNo: "OD-A" },
      ctx,
    )
    await tools.collectWechat.execute(
      { wechatId: "validId456", orderNo: "OD-B" },
      ctx,
    )
    expect(prisma.agentLead.create).toHaveBeenCalledTimes(2)
    // Both rows must carry independent wechatIds — no merging.
    const first = (prisma.agentLead.create as jest.Mock).mock.calls[0][0].data
    const second = (prisma.agentLead.create as jest.Mock).mock.calls[1][0].data
    expect(first.wechatId).toBe("validId123")
    expect(second.wechatId).toBe("validId456")
  })

  it("rejects invalid wechatId via Zod", () => {
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const result = tools.collectWechat.inputSchema.safeParse({ wechatId: "1invalid" })
    expect(result.success).toBe(false)
  })
})

describe("escalateToHuman", () => {
  beforeEach(() => {
    ;(prisma.agentMessage.findMany as jest.Mock).mockResolvedValue([
      { role: "USER", contentText: "我要退款", toolName: null, createdAt: new Date() },
    ])
    ;(prisma.$transaction as jest.Mock).mockResolvedValue([])
    ;(prisma.agentSession.update as jest.Mock).mockResolvedValue({})
  })

  it("customer_support + verified orderNo: Lead created, renderQr=true, session.escalated flipped", async () => {
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce({ orderNo: "OD-OK" })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.escalateToHuman.execute(
      { reason: "退款诉求", urgency: "MED", orderNo: "OD-OK" },
      ctx,
    )) as {
      qrUrl: string
      message: string
      orderNoVerified: boolean
      renderQr: boolean
    }
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(r.renderQr).toBe(true)
    expect(r.orderNoVerified).toBe(true)
    expect(r.message).toMatch(/已为您转接人工客服/)
  })

  it("customer_support + bogus orderNo: no Lead, NO renderQr, session.escalated NOT flipped (no actionable handoff yet)", async () => {
    // Policy update: an unverified orderNo doesn't even flip the escalated
    // flag, because nothing actionable happened — AI must keep asking
    // until orderNo is verified.
    ;(prisma.order.findFirst as jest.Mock).mockResolvedValueOnce(null)
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.escalateToHuman.execute(
      { reason: "客户给了订单号但输错", urgency: "MED", orderNo: "OD-TYPO" },
      ctx,
    )) as {
      message: string
      renderQr: boolean
      orderNoVerified: boolean
      requiresOrderNoFix: boolean
    }
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.agentSession.update).not.toHaveBeenCalled()
    expect(r.renderQr).toBe(false)
    expect(r.orderNoVerified).toBe(false)
    expect(r.requiresOrderNoFix).toBe(true)
    expect(r.message).toMatch(/查不到|复核/)
  })

  it("customer_support + missing orderNo: no Lead, no QR — AI must keep iterating", async () => {
    // Replaces the old "bare QR fallback" path. Customer-support
    // handoffs without a verified orderNo create a black hole for ops
    // (can't match wechat contact back to chat), so we refuse to render
    // QR until AI gets a verified orderNo. Lead and escalated stay off.
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.escalateToHuman.execute(
      { reason: "新访客要人工", urgency: "MED" },
      ctx,
    )) as { renderQr: boolean; message: string }
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.agentSession.update).not.toHaveBeenCalled()
    expect(r.renderQr).toBe(false)
    // Message should prompt for orderNo OR for clarification of intent
    expect(r.message).toMatch(/订单号|合作/)
  })

  it("business_inquiry: skips orderNo gate, creates Lead with [合作咨询] tag, renderQr=true", async () => {
    // The only escape from the orderNo discipline. Cooperation /
    // partnership / press / ad inquiries are not order-anchored; ops
    // still wants the wechat handoff. Lead reason prefixed so the
    // admin queue can split partnership leads from customer-support.
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.escalateToHuman.execute(
      {
        reason: "想做美区分销代理",
        urgency: "MED",
        intent: "business_inquiry",
      },
      ctx,
    )) as { renderQr: boolean; intent: string; qrUrl: string }
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(r.renderQr).toBe(true)
    expect(r.intent).toBe("business_inquiry")
    // agentLead.create is invoked (synchronously, since it's mocked) to
    // build the array passed to $transaction — its args are recorded.
    const createCall = (prisma.agentLead.create as jest.Mock).mock.calls.find(
      ([arg]) => arg?.data?.reason?.startsWith("[合作咨询]"),
    )
    expect(createCall).toBeDefined()
  })

  it("creates a new Lead row per call — never upserts, even on repeated escalations in one session", async () => {
    // Regression guard for "two consultations on the same session"
    // scenario: previously the second escalate would upsert + overwrite
    // the first lead's reason / urgency / snapshot, silently destroying
    // the earlier consultation. Now each call must insert independently.
    ;(prisma.order.findFirst as jest.Mock)
      .mockResolvedValueOnce({ orderNo: "OD-1" })
      .mockResolvedValueOnce({ orderNo: "OD-2" })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    await tools.escalateToHuman.execute(
      { reason: "周一退款", urgency: "MED", orderNo: "OD-1" },
      ctx,
    )
    await tools.escalateToHuman.execute(
      { reason: "周二登不上", urgency: "HIGH", orderNo: "OD-2" },
      ctx,
    )
    // $transaction called twice (once per escalate); each transaction
    // contains an agentLead.create + agentSession.update pair.
    expect(prisma.$transaction).toHaveBeenCalledTimes(2)
    // The runtime Lead model exposes create only — no upsert in the mock,
    // so any accidental upsert call would crash the test loudly.
    expect("upsert" in (prisma.agentLead as object)).toBe(false)
  })

  it("triggers webhook fetch when urgency=HIGH and webhook url configured", async () => {
    jest.resetModules()
    jest.doMock("@/lib/config", () => ({
      config: {
        wechatQrUrl: "https://q",
        wechatId: "id",
        siteUrl: "https://s",
        escalateWebhookUrl: "https://bark.example/x",
        businessHoursStart: 9,
        businessHoursEnd: 22,
        businessHoursTimezone: "Asia/Shanghai",
      },
    }))
    jest.doMock("@/lib/site-settings", () => ({
      getSiteSettings: jest.fn().mockResolvedValue({
        wechatQrUrl: "https://q",
        wechatId: "id",
        businessHoursStart: 9,
        businessHoursEnd: 22,
        businessHoursTimezone: "Asia/Shanghai",
        businessName: "",
        businessLicenseNo: "",
        contactEmail: "",
        escalateWebhookUrl: "https://bark.example/x",
      }),
      getSiteSettingRow: jest.fn().mockResolvedValue(null),
    }))
    jest.doMock("@/lib/prisma", () => ({
      prisma: {
        agentLead: { create: jest.fn(), findFirst: jest.fn() },
        agentMessage: {
          findMany: jest.fn().mockResolvedValue([
            { role: "USER", contentText: "卡密失效", toolName: null, createdAt: new Date() },
          ]),
        },
        agentSession: { update: jest.fn().mockResolvedValue({}) },
        order: {
          findFirst: jest.fn().mockResolvedValue({ orderNo: "OD-HOT" }),
        },
        $transaction: jest.fn().mockResolvedValue([]),
      },
    }))
    jest.doMock("@/lib/business-hours", () => ({
      isInBusinessHours: jest.fn().mockResolvedValue(true),
    }))
    const reimported = (await import("@/lib/agent-cs")) as unknown as {
      buildCSTools: (s: string) => ToolsRecord
    }
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }))
    const tools = reimported.buildCSTools("s1")
    await tools.escalateToHuman.execute(
      { reason: "卡密失效", urgency: "HIGH", orderNo: "OD-HOT" },
      ctx,
    )
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://bark.example/x",
      expect.objectContaining({ method: "POST" }),
    )
    fetchSpy.mockRestore()
  })
})

describe("buildCSPrompt — context rendering & red-line completeness", () => {
  const makeBase = () => ({
    knowledge: [
      { id: "kb-001", title: "共享号商品说明", content: "动态密码", tags: ["商品", "共享号"] },
    ],
    products: [
      {
        id: "p1",
        name: "共享号·美区",
        slug: "share-us",
        summary: "多人共用 Apple ID",
        price: 9.9,
        productType: "AUTO_FETCH",
        tags: [{ name: "共享号" }],
      },
    ],
    siteName: "空域账号商城",
    businessHoursText: "09:00 – 22:00（Asia/Shanghai）",
  })

  it("includes business hours in the platform header", () => {
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toContain("营业时间：09:00 – 22:00（Asia/Shanghai）")
  })

  it("renders user-order context when hints are provided", () => {
    const prompt = buildCSPrompt({
      ...makeBase(),
      userOrders: [
        { orderNo: "OD-AUTO-1", product: "共享号·美区", status: "COMPLETED", paidAt: "2026-05-18" },
      ],
    })
    expect(prompt).toContain("用户本机最近订单")
    expect(prompt).toContain("OD-AUTO-1")
    expect(prompt).toContain("共享号·美区")
    expect(prompt).toContain("付款 2026-05-18")
  })

  it("forces multi-order disambiguation instead of defaulting to the first order", () => {
    // Regression: with multiple userOrders the AI was silently calling
    // lookup_order on the first one, answering a question that may have
    // been about a different order — high risk of misleading the user.
    // Prompt now requires the AI to list the orders and ask which one
    // when the request is ambiguous.
    const prompt = buildCSPrompt({
      ...makeBase(),
      userOrders: [
        { orderNo: "OD-A", product: "共享号·美区", status: "COMPLETED", paidAt: "2026-05-18" },
        { orderNo: "OD-B", product: "独享号·港区", status: "COMPLETED", paidAt: "2026-05-19" },
      ],
    })
    // Disambiguation rule is present and mentions the actual count.
    expect(prompt).toMatch(/共\s*2\s*个订单/)
    expect(prompt).toMatch(/必须先列出订单让用户选/)
    expect(prompt).toMatch(/不能默认拿第一个/)
    // The "single order = no need to ask" shortcut also documented so the
    // AI doesn't over-question single-order users.
    expect(prompt).toMatch(/如果只有 1 个订单.*不必反问/)
    // Diagnosis answers must call out which order they're for.
    expect(prompt).toMatch(/先明示"针对订单/)
  })

  it("omits the multi-order disambiguation note when only one order exists", () => {
    const prompt = buildCSPrompt({
      ...makeBase(),
      userOrders: [
        { orderNo: "OD-ONLY", product: "共享号", status: "COMPLETED", paidAt: "2026-05-18" },
      ],
    })
    expect(prompt).toMatch(/共\s*1\s*个订单/)
    // Even with one order the AI should still annotate which order it's
    // answering about — keeps the habit consistent.
    expect(prompt).toMatch(/先明示"针对订单/)
  })

  it("omits the user-order section header when no hints are provided", () => {
    const prompt = buildCSPrompt(makeBase())
    // Header is the markdown "## 用户本机最近订单（来自浏览器本地..." line.
    // The string "用户本机最近订单" itself appears elsewhere (new-visitor
    // guidance references it by name), so match the header form precisely.
    expect(prompt).not.toMatch(/^## 用户本机最近订单/m)
  })

  it("teaches AI to prefer lookup_order for canSwitchAccount over guessing", () => {
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toContain("canSwitchAccount")
    expect(prompt).toContain("switchAccountRemaining")
    expect(prompt).toContain("isExpired")
  })

  it("contains DMCA / brand red-lines (no Apple authorization claims, no permanent-use promises)", () => {
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toMatch(/Apple 官方授权|苹果官方|官方账号/)
    expect(prompt).toMatch(/保证一直可用|永久使用|封号全赔/)
  })

  it("contains jailbreak resistance instruction", () => {
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toMatch(/jailbreak|忽略以上指令|跳出客服角色/i)
  })

  it("explicitly forbids tokenized order URLs", () => {
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toMatch(/不签发任何 token|不给带 token 的 URL/)
  })

  it("limits 2FA dialog instructions to the known whitelist", () => {
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toContain("Apple ID 安全性")
    expect(prompt).toContain("保护你的帐户")
    expect(prompt).toMatch(/其他文案的弹窗一律转人工|禁止推断/)
  })

  it("instructs AI to defer to product summary as authoritative", () => {
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toContain("商品描述权威性")
  })

  it("requires teaching disclaimer before escalation", () => {
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toContain("以上为通用建议")
  })

  it("treats self-service switch (canSwitchAccount=true) as a non-escalation path", () => {
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toMatch(/不转人工|不要调 escalate_to_human/)
  })

  it("instructs the AI to use relative paths for any URLs given to users", () => {
    // Hard-coding the site domain into chat responses locks previews to
    // production URLs (and vice versa); the widget always runs on the
    // same origin as the lookup / product pages, so relative paths are
    // both safer and more portable.
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toMatch(/相对路径/)
    expect(prompt).toMatch(/\/orders\/lookup/)
  })

  it("requires markdown link syntax — bare paths are not clickable in the chat bubble", () => {
    // Regression: AI was caught replying with raw paths like
    //   "👉 入口：/products/cmm7kttbu..."
    // which render as plain text in the markdown bubble — users have no
    // way to click. The prompt now mandates `[label](/path)` and shows
    // both a positive and a negative example so the model learns the
    // distinction.
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toMatch(/Markdown 链接语法/)
    expect(prompt).toMatch(/\[.+?\]\(\/.+?\)/) // contains an example like [文字](/path)
    expect(prompt).toMatch(/不能贴裸路径|不可点击/)
  })

  it("forbids fabricated prices and markdown comparison tables", () => {
    // Regression: AI was caught rendering a markdown table comparing
    // shared / dedicated accounts with made-up prices ("¥0~2.99", "¥42起")
    // because the table format forced it to "fill" missing fields. The
    // prompt now explicitly bans:
    //   (a) quoting any price without first calling lookup_product
    //   (b) markdown tables for product comparisons
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toMatch(/必须先调 lookup_product/)
    expect(prompt).toMatch(/禁止用 Markdown 表格/)
    expect(prompt).toMatch(/价格回答硬规则|不写具体金额/)
  })

  it("mandates verify_order before passing user-supplied orderNo to escalate / collect_wechat", () => {
    // Without this, AI would happily pass any plausible-looking string
    // ("OD12345", "我的订单 123", etc.) to escalate_to_human and ops
    // would chase ghosts. The verify_order tool is the cheap pre-flight
    // and the prompt must teach AI to use it as a gate.
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toMatch(/调 verify_order\(orderNo\)/)
    // Failure path must be explicit
    expect(prompt).toMatch(/exists=false|exists: false/)
    expect(prompt).toMatch(/没调 verify_order 就直接传给 escalate_to_human/)
    // First-step shortcut allowed (userOrders段订单号已服务端验证)
    expect(prompt).toMatch(/跳过 verify_order/)
  })

  it("requires the AI to exhaust 4 steps before showing the bare QR (no-orderNo path is last-resort)", () => {
    // Regression: AI was caught dropping the QR card immediately when a
    // user said "找人工", without asking for the order number first.
    // The post-mortem rule: ops can't match the wechat contact to a
    // chat session without an orderNo, so a QR-only handoff is a black
    // hole. Prompt now defines an explicit 4-step funnel (本机订单段 →
    // 主动问 → 邮箱反查 → 兜底 QR) and forbids skipping to step 4.
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toContain("转人工前置流程")
    // Steps 1–3 still mandatory; step 4 (bare QR fallback) was killed
    // — customer support handoffs ALWAYS need a verified orderNo now.
    expect(prompt).toMatch(/第 1 步/)
    expect(prompt).toMatch(/第 2 步/)
    expect(prompt).toMatch(/第 3 步/)
    expect(prompt).toContain('没有"第 4 步兜底 QR"')
    // The "ask for orderNo" mandatory phrasing
    expect(prompt).toMatch(/订单号一般是您下单后页面顶部那串编号/)
    // Email-fallback step must reference the lookup page
    expect(prompt).toMatch(/\[订单查询页\]\(\/orders\/lookup\)/)
    // 合作 escape hatch must be present + ringfenced
    expect(prompt).toContain("合作咨询例外")
    expect(prompt).toMatch(/intent: "business_inquiry"/)
    expect(prompt).toMatch(/代理|批发|分销/)
    // The hard prohibitions
    expect(prompt).toMatch(/用户一句"找人工"就以为是合作/)
    expect(prompt).toMatch(/编造一个看着像的订单号/)
  })

  it("renders the canonical URL in the product index so AI never composes /products/<id>", () => {
    // Regression: AI was caught pasting the cuid as the URL path
    // (e.g. /products/cmoolt5wx0000if04nmrah773), bypassing lookup_product
    // and producing a 404. The product index now ships a ready-to-copy
    // URL=/products/<slug> string with each row, plus a red line in
    // the linking rules forbidding URL composition from the id.
    const base = makeBase()
    const prompt = buildCSPrompt({
      ...base,
      products: [
        {
          id: "cmoolt5wx0000if04nmrah773",
          name: "美区Apple ID 独享·已购小火箭",
          slug: "apple-id-shadowrocket-us",
          summary: null,
          price: 62,
          productType: "MANUAL",
          tags: [],
        },
      ],
    })
    expect(prompt).toContain("URL=`/products/apple-id-shadowrocket-us`")
    expect(prompt).not.toContain("/products/cmoolt5wx0000if04nmrah773")
    expect(prompt).toMatch(/绝不能从 `id` 拼接/)
  })

  it("flags free (price=0) products in the index so AI can recommend them to first-time visitors", () => {
    const base = makeBase()
    const prompt = buildCSPrompt({
      ...base,
      products: [
        ...base.products,
        {
          id: "p-free",
          name: "免费试用·美区共享号",
          slug: "free-trial",
          summary: "首次试用",
          price: 0,
          productType: "AUTO_FETCH",
          tags: [{ name: "免费" }],
        },
      ],
    })
    expect(prompt).toMatch(/¥0（免费）/)
    expect(prompt).toContain("免费试用·美区共享号")
  })

  it("teaches AI to route first-time visitors to free products", () => {
    // Drop-in regression: real customers arriving from external links don't
    // know how to find their account, and historically AI would assume they
    // had bought something. Prompt must explicitly handle the "new visitor"
    // case with the free try-it product on offer.
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toMatch(/新访客|引流用户/)
    expect(prompt).toMatch(/免费/)
    expect(prompt).toMatch(/不要编造免费商品/)
  })

  it("treats canSwitchAccount=false (quota exhausted / expired) as a self-service path, NOT an escalation", () => {
    // Earlier rule was "any canSwitchAccount=false → escalate". The
    // operator clarified: AI can handle all 2FA-bound scenarios except the
    // backend pool truly being empty. Validate the new branch routes:
    //   - switchAccountRemaining=0 → 重新下单
    //   - isExpired=true → 重新下单
    //   - 用户报告"无可用账号" → 才转人工
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toMatch(/switchAccountRemaining=0[\s\S]{0,200}重新下单/)
    expect(prompt).toMatch(/isExpired=true[\s\S]{0,200}重新下单/)
    expect(prompt).toMatch(/无可用账号/)
    expect(prompt).toMatch(/以上三种情形都不转人工/)
  })

  it("enforces 'real-data only' for all product facts (not just prices)", () => {
    // Generalization of the price-fabrication regression. Any product or
    // order fact — stock, validity period, switch quota, iCloud support,
    // refund terms, in-app purchases, etc. — must come from the tools,
    // the product index, or the knowledge base. This test pins the
    // explicit ban list so a refactor that loosens the rule (or quietly
    // drops a field) will fail loudly.
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).toMatch(/实数据|商品事实/)
    // Field-level enumeration the rule must list (subset; full list lives
    // in the prompt itself).
    expect(prompt).toMatch(/库存|是否在售/)
    expect(prompt).toMatch(/使用期限|有效期/)
    expect(prompt).toMatch(/更换次数|switchAccountRemaining/)
    expect(prompt).toMatch(/退款.*政策|售后.*政策/)
    // Failure mode: AI should defer to a "let me check" / "ask support"
    // response instead of guessing.
    expect(prompt).toMatch(/不要猜|不要类比其他平台|绝不猜/)
    // "Do we have product X?" — when absent from the index, the AI must
    // not invent. Pin the exact "暂未上架" guidance so this stays explicit.
    expect(prompt).toMatch(/暂未上架/)
  })

  it("does NOT bake any absolute site URL into the system prompt header", () => {
    // The previous "## 平台信息 - 站点：${siteUrl}" line caused the AI
    // to echo the production domain back to users on preview deploys.
    // The platform header must not contain any concrete origin.
    const prompt = buildCSPrompt(makeBase())
    expect(prompt).not.toMatch(/站点：\s*https?:\/\//)
    // Defense in depth: explicitly forbid common host placeholders that
    // would only appear if someone reintroduced the bug.
    expect(prompt).not.toContain("example.com")
    expect(prompt).not.toContain("vercel.app")
  })
})

describe("escalateToHuman tool message — uses order-number-driven handoff (no '已同步给客服' wording)", () => {
  beforeEach(() => {
    ;(prisma.agentMessage.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.$transaction as jest.Mock).mockResolvedValue([])
  })

  it("includes 'send your order number' phrasing in business hours", async () => {
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.escalateToHuman.execute(
      { reason: "退款", urgency: "MED" },
      ctx,
    )) as { message: string }
    expect(r.message).toContain("订单号")
    expect(r.message).not.toContain("已同步给客服")
  })
})

describe("collectWechat tool message — sets correct expectation (user must scan QR, not wait for callback)", () => {
  beforeEach(() => {
    ;(prisma.agentMessage.findMany as jest.Mock).mockResolvedValue([])
  })

  it("never claims customer service will proactively contact the user", async () => {
    ;(prisma.agentLead.create as jest.Mock).mockResolvedValueOnce({ id: "lead-1" })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.collectWechat.execute(
      { wechatId: "validId123" },
      ctx,
    )) as { message: string }
    expect(r.message).not.toContain("客服会主动加您")
    expect(r.message).toMatch(/扫码|订单号/)
  })
})
