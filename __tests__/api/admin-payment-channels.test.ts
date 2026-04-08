import { NextResponse } from "next/server"
import { GET, POST } from "@/app/api/admin/payment-channels/route"
import { prismaMock } from "../../__mocks__/prisma"
import { getAdminSession } from "@/lib/auth-guard"

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
  __esModule: true,
  getAdminSession: jest.fn(),
}))

const sessionMock = getAdminSession as jest.Mock

function makeRequest(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/admin/payment-channels", {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as Request
}

const baseChannel = {
  id: "chan-1",
  nickname: "支付宝主渠道",
  pid: "pid-001",
  key: "secret-key",
  submitUrl: "https://pay.example.com/submit",
  siteName: "示例站",
  type: "alipay" as const,
  annualLimit: 65000,
  sortOrder: 0,
  isActive: true,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  paymentMethod: "alipay",
}

describe("GET /api/admin/payment-channels", () => {
  beforeEach(() => {
    sessionMock.mockResolvedValue({ user: { id: "admin-1" } })
  })

  it("未登录返回 401", async () => {
    sessionMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("无渠道时返回空数组", async () => {
    prismaMock.paymentChannel.findMany.mockResolvedValue([])
    const res = await GET()
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toEqual([])
  })

  it("返回渠道列表，含计算字段，不含 key", async () => {
    prismaMock.paymentChannel.findMany.mockResolvedValue([baseChannel])
    // yearIncomeRows
    prismaMock.order.groupBy.mockResolvedValueOnce([
      { paymentChannelId: "chan-1", _sum: { amount: 3000 } },
    ])
    // totalIncomeRows
    prismaMock.order.groupBy.mockResolvedValueOnce([
      { paymentChannelId: "chan-1", _sum: { amount: 5000 } },
    ])
    // withdrawalRows
    prismaMock.channelWithdrawal.groupBy.mockResolvedValue([
      { channelId: "chan-1", _sum: { amount: 1000 } },
    ])

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)

    const ch = json.data[0]
    expect(ch.id).toBe("chan-1")
    expect(ch.yearIncome).toBe(3000)
    expect(ch.totalIncome).toBe(5000)
    expect(ch.totalWithdrawn).toBe(1000)
    expect(ch.balance).toBe(4000)
    expect(ch).not.toHaveProperty("key")
  })
})

describe("POST /api/admin/payment-channels", () => {
  beforeEach(() => {
    sessionMock.mockResolvedValue({ user: { id: "admin-1" } })
  })

  it("未登录返回 401", async () => {
    sessionMock.mockResolvedValue(null)
    const req = makeRequest("POST", {})
    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })

  it("缺少必填字段返回 400", async () => {
    const req = makeRequest("POST", { nickname: "test" })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it("成功创建返回 201，不含 key", async () => {
    const created = { ...baseChannel }
    prismaMock.paymentChannel.create.mockResolvedValue(created)

    const body = {
      nickname: "支付宝主渠道",
      pid: "pid-001",
      key: "secret-key",
      submitUrl: "https://pay.example.com/submit",
      siteName: "示例站",
      type: "alipay",
    }
    const req = makeRequest("POST", body)
    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.data).toBeDefined()
    expect(json.data).not.toHaveProperty("key")
    expect(json.data.id).toBe("chan-1")
  })
})
