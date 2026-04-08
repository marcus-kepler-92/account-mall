import { POST } from "@/app/api/admin/payment-channels/[id]/backfill/route"
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

function makeRequest(): Request {
  return new Request("http://localhost/api/admin/payment-channels/chan-1/backfill", {
    method: "POST",
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

describe("POST /api/admin/payment-channels/[id]/backfill", () => {
  beforeEach(() => {
    sessionMock.mockResolvedValue({ user: { id: "admin-1" } })
  })

  it("未登录返回 401", async () => {
    sessionMock.mockResolvedValue(null)
    const req = makeRequest()
    const res = await POST(req as any, makeContext("chan-1"))
    expect(res.status).toBe(401)
  })

  it("渠道不存在返回 404", async () => {
    prismaMock.paymentChannel.findUnique.mockResolvedValue(null)
    const req = makeRequest()
    const res = await POST(req as any, makeContext("nonexistent"))
    expect(res.status).toBe(404)
  })

  it("成功归因：updateMany 使用正确条件，返回更新数量", async () => {
    prismaMock.paymentChannel.findUnique.mockResolvedValue(baseChannel)
    prismaMock.order.updateMany.mockResolvedValue({ count: 7 })

    const req = makeRequest()
    const res = await POST(req as any, makeContext("chan-1"))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual({ updated: 7 })

    // Verify the correct where clause was used
    expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
      where: {
        paymentChannelId: null,
        paymentMethod: "alipay",
      },
      data: { paymentChannelId: "chan-1" },
    })
  })
})
