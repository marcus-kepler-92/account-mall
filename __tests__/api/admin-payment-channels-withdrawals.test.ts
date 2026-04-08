import { GET, POST } from "@/app/api/admin/payment-channels/[id]/withdrawals/route"
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

function makeGetRequest(): Request {
  return new Request("http://localhost/api/admin/payment-channels/chan-1/withdrawals", {
    method: "GET",
  }) as unknown as Request
}

function makePostRequest(body?: unknown): Request {
  return new Request("http://localhost/api/admin/payment-channels/chan-1/withdrawals", {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as Request
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) }
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

const baseWithdrawal = {
  id: "wd-1",
  channelId: "chan-1",
  amount: 1000,
  note: "月结",
  createdAt: new Date("2024-02-01T00:00:00Z"),
  updatedAt: new Date("2024-02-01T00:00:00Z"),
}

describe("GET /api/admin/payment-channels/[id]/withdrawals", () => {
  beforeEach(() => {
    sessionMock.mockResolvedValue({ user: { id: "admin-1" } })
  })

  it("未登录返回 401", async () => {
    sessionMock.mockResolvedValue(null)
    const req = makeGetRequest()
    const res = await GET(req as any, makeContext("chan-1"))
    expect(res.status).toBe(401)
  })

  it("渠道不存在返回 404", async () => {
    prismaMock.paymentChannel.findUnique.mockResolvedValue(null)
    const req = makeGetRequest()
    const res = await GET(req as any, makeContext("nonexistent"))
    expect(res.status).toBe(404)
  })

  it("返回提现记录列表", async () => {
    prismaMock.paymentChannel.findUnique.mockResolvedValue(baseChannel)
    prismaMock.channelWithdrawal.findMany.mockResolvedValue([baseWithdrawal])

    const req = makeGetRequest()
    const res = await GET(req as any, makeContext("chan-1"))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.data[0].id).toBe("wd-1")
  })
})

describe("POST /api/admin/payment-channels/[id]/withdrawals", () => {
  beforeEach(() => {
    sessionMock.mockResolvedValue({ user: { id: "admin-1" } })
  })

  it("未登录返回 401", async () => {
    sessionMock.mockResolvedValue(null)
    const req = makePostRequest({ amount: 100 })
    const res = await POST(req as any, makeContext("chan-1"))
    expect(res.status).toBe(401)
  })

  it("渠道不存在返回 404", async () => {
    prismaMock.paymentChannel.findUnique.mockResolvedValue(null)
    const req = makePostRequest({ amount: 100 })
    const res = await POST(req as any, makeContext("nonexistent"))
    expect(res.status).toBe(404)
  })

  it("余额不足返回 400（income=0, withdrawn=0, 提现 100）", async () => {
    prismaMock.paymentChannel.findUnique.mockResolvedValue(baseChannel)
    // income = 0
    prismaMock.order.aggregate.mockResolvedValueOnce({ _sum: { amount: null } })
    // withdrawn = 0
    prismaMock.channelWithdrawal.aggregate.mockResolvedValueOnce({ _sum: { amount: null } })

    const req = makePostRequest({ amount: 100 })
    const res = await POST(req as any, makeContext("chan-1"))
    expect(res.status).toBe(400)
  })

  it("余额充足时创建成功返回 201（income=5000, withdrawn=1000, 余额=4000, 提现 1000）", async () => {
    prismaMock.paymentChannel.findUnique.mockResolvedValue(baseChannel)
    prismaMock.order.aggregate.mockResolvedValueOnce({ _sum: { amount: 5000 } })
    prismaMock.channelWithdrawal.aggregate.mockResolvedValueOnce({ _sum: { amount: 1000 } })
    prismaMock.channelWithdrawal.create.mockResolvedValue({
      ...baseWithdrawal,
      amount: 1000,
    })

    const req = makePostRequest({ amount: 1000 })
    const res = await POST(req as any, makeContext("chan-1"))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.data.id).toBe("wd-1")
  })

  it("余额恰好等于提现金额时也成功（income=5000, withdrawn=4000, 余额=1000, 提现 1000）", async () => {
    prismaMock.paymentChannel.findUnique.mockResolvedValue(baseChannel)
    prismaMock.order.aggregate.mockResolvedValueOnce({ _sum: { amount: 5000 } })
    prismaMock.channelWithdrawal.aggregate.mockResolvedValueOnce({ _sum: { amount: 4000 } })
    prismaMock.channelWithdrawal.create.mockResolvedValue({
      ...baseWithdrawal,
      amount: 1000,
    })

    const req = makePostRequest({ amount: 1000 })
    const res = await POST(req as any, makeContext("chan-1"))

    expect(res.status).toBe(201)
  })
})
