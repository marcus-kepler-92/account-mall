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
    agentLead: { upsert: jest.fn() },
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
        // Relative path so the chat widget on any host (preview / prod /
        // local) lands users on the same-origin product page.
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

describe("collectWechat", () => {
  it("upserts Lead with status=PENDING_CONTACT and returns QR", async () => {
    ;(prisma.agentLead.upsert as jest.Mock).mockResolvedValueOnce({ id: "l1" })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = await tools.collectWechat.execute({ wechatId: "validId123" }, ctx)
    expect(prisma.agentLead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: "PENDING_CONTACT",
          wechatId: "validId123",
          reason: "用户主动提供",
        }),
        update: { wechatId: "validId123" },
      }),
    )
    expect(r).toMatchObject({
      ok: true,
      qrUrl: expect.any(String),
      wechatId: expect.any(String),
    })
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
  })

  it("upserts Lead with NEW status, marks session.escalated", async () => {
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = await tools.escalateToHuman.execute({ reason: "退款诉求", urgency: "MED" }, ctx)
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(r).toMatchObject({ qrUrl: expect.any(String), message: expect.any(String) })
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
        agentLead: { upsert: jest.fn() },
        agentMessage: {
          findMany: jest.fn().mockResolvedValue([
            { role: "USER", contentText: "卡密失效", toolName: null, createdAt: new Date() },
          ]),
        },
        agentSession: { update: jest.fn() },
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
    await tools.escalateToHuman.execute({ reason: "卡密失效", urgency: "HIGH" }, ctx)
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
  it("never claims customer service will proactively contact the user", async () => {
    ;(prisma.agentLead.upsert as jest.Mock).mockResolvedValueOnce({ id: "lead-1" })
    const tools = buildCSTools("s1") as unknown as ToolsRecord
    const r = (await tools.collectWechat.execute(
      { wechatId: "validId123" },
      ctx,
    )) as { message: string }
    expect(r.message).not.toContain("客服会主动加您")
    expect(r.message).toMatch(/扫码|订单号/)
  })
})
