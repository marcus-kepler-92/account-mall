import { PATCH } from "@/app/api/admin/payment-channels/[id]/route"
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

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost/api/admin/payment-channels/chan-1", {
    method: "PATCH",
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

describe("PATCH /api/admin/payment-channels/[id]", () => {
  beforeEach(() => {
    sessionMock.mockResolvedValue({ user: { id: "admin-1" } })
  })

  it("未登录返回 401", async () => {
    sessionMock.mockResolvedValue(null)
    const req = makeRequest({ nickname: "new name" })
    const res = await PATCH(req as any, makeContext("chan-1"))
    expect(res.status).toBe(401)
  })

  it("渠道不存在返回 404", async () => {
    prismaMock.paymentChannel.findUnique.mockResolvedValue(null)
    const req = makeRequest({ nickname: "new name" })
    const res = await PATCH(req as any, makeContext("nonexistent"))
    expect(res.status).toBe(404)
  })

  it("成功更新，响应不含 key", async () => {
    prismaMock.paymentChannel.findUnique.mockResolvedValue(baseChannel)
    const updated = { ...baseChannel, nickname: "新备注" }
    prismaMock.paymentChannel.update.mockResolvedValue(updated)

    const req = makeRequest({ nickname: "新备注" })
    const res = await PATCH(req as any, makeContext("chan-1"))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.nickname).toBe("新备注")
    expect(json.data).not.toHaveProperty("key")
  })
})
