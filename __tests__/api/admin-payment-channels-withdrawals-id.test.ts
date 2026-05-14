import { PATCH, DELETE } from "@/app/api/admin/payment-channels/[id]/withdrawals/[withdrawalId]/route"
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
  return new Request("http://localhost/api/admin/payment-channels/chan-1/withdrawals/wd-1", {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as Request
}

function makeContext(id: string, withdrawalId: string) {
  return { params: Promise.resolve({ id, withdrawalId }) }
}

const baseWithdrawal = {
  id: "wd-1",
  channelId: "chan-1",
  amount: 1000,
  note: "月结",
  createdAt: new Date("2024-02-01T00:00:00Z"),
  updatedAt: new Date("2024-02-01T00:00:00Z"),
}

describe("PATCH /api/admin/payment-channels/[id]/withdrawals/[withdrawalId]", () => {
  beforeEach(() => {
    sessionMock.mockResolvedValue({ user: { id: "admin-1" } })
  })

  it("未登录返回 401", async () => {
    sessionMock.mockResolvedValue(null)
    const req = makeRequest("PATCH", { note: "new note" })
    const res = await PATCH(req as any, makeContext("chan-1", "wd-1"))
    expect(res.status).toBe(401)
  })

  it("提现记录不存在返回 404", async () => {
    prismaMock.channelWithdrawal.findUnique.mockResolvedValue(null)
    const req = makeRequest("PATCH", { note: "new note" })
    const res = await PATCH(req as any, makeContext("chan-1", "nonexistent"))
    expect(res.status).toBe(404)
  })

  it("修改金额后余额将为负时返回 400", async () => {
    // existing withdrawal amount = 1000
    prismaMock.channelWithdrawal.findUnique.mockResolvedValue(baseWithdrawal)
    // income = 2000, withdrawn = 1000 (existing wd)
    // balanceIfUpdated = 2000 - 1000 + 1000 - 3000 = -1000 → negative → 400
    prismaMock.order.aggregate.mockResolvedValueOnce({ _sum: { amount: 2000 } })
    prismaMock.channelWithdrawal.aggregate.mockResolvedValueOnce({ _sum: { amount: 1000 } })

    const req = makeRequest("PATCH", { amount: 3000 })
    const res = await PATCH(req as any, makeContext("chan-1", "wd-1"))
    expect(res.status).toBe(400)
  })

  it("修改金额后余额>=0 时成功", async () => {
    prismaMock.channelWithdrawal.findUnique.mockResolvedValue(baseWithdrawal)
    // income = 5000, withdrawn = 1000
    // balanceIfUpdated = 5000 - 1000 + 1000 - 2000 = 3000 → ok
    prismaMock.order.aggregate.mockResolvedValueOnce({ _sum: { amount: 5000 } })
    prismaMock.channelWithdrawal.aggregate.mockResolvedValueOnce({ _sum: { amount: 1000 } })
    prismaMock.channelWithdrawal.update.mockResolvedValue({ ...baseWithdrawal, amount: 2000 })

    const req = makeRequest("PATCH", { amount: 2000 })
    const res = await PATCH(req as any, makeContext("chan-1", "wd-1"))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.id).toBe("wd-1")
  })

  it("修改金额为恰好等于余额（小数）时不因浮点误差拒绝", async () => {
    // existing withdrawal amount = 89.7
    const withdrawal = { ...baseWithdrawal, amount: 89.7 }
    prismaMock.channelWithdrawal.findUnique.mockResolvedValue(withdrawal as any)
    // income = 100, total withdrawn = 89.7
    // currentBalanceCents = 10000 - 8970 = 1030
    // balanceIfUpdated = 1030 + 8970 - 1030 = 8970 cents → positive → ok
    prismaMock.order.aggregate.mockResolvedValueOnce({ _sum: { amount: 100 } } as any)
    prismaMock.channelWithdrawal.aggregate.mockResolvedValueOnce({ _sum: { amount: 89.7 } } as any)
    prismaMock.channelWithdrawal.update.mockResolvedValue({ ...withdrawal, amount: 10.3 } as any)

    const req = makeRequest("PATCH", { amount: 10.3 })
    const res = await PATCH(req as any, makeContext("chan-1", "wd-1"))
    expect(res.status).toBe(200)
  })

  it("只修改 note 时不触发余额校验，直接成功", async () => {
    prismaMock.channelWithdrawal.findUnique.mockResolvedValue(baseWithdrawal)
    prismaMock.channelWithdrawal.update.mockResolvedValue({ ...baseWithdrawal, note: "updated note" })

    const req = makeRequest("PATCH", { note: "updated note" })
    const res = await PATCH(req as any, makeContext("chan-1", "wd-1"))
    const json = await res.json()

    expect(res.status).toBe(200)
    // Ensure aggregate was NOT called (no balance check needed)
    expect(prismaMock.order.aggregate).not.toHaveBeenCalled()
    expect(json.data.note).toBe("updated note")
  })
})

describe("DELETE /api/admin/payment-channels/[id]/withdrawals/[withdrawalId]", () => {
  beforeEach(() => {
    sessionMock.mockResolvedValue({ user: { id: "admin-1" } })
  })

  it("未登录返回 401", async () => {
    sessionMock.mockResolvedValue(null)
    const req = makeRequest("DELETE")
    const res = await DELETE(req as any, makeContext("chan-1", "wd-1"))
    expect(res.status).toBe(401)
  })

  it("提现记录不存在返回 404", async () => {
    prismaMock.channelWithdrawal.findUnique.mockResolvedValue(null)
    const req = makeRequest("DELETE")
    const res = await DELETE(req as any, makeContext("chan-1", "nonexistent"))
    expect(res.status).toBe(404)
  })

  it("成功删除返回 { data: { id: withdrawalId } }", async () => {
    prismaMock.channelWithdrawal.findUnique.mockResolvedValue(baseWithdrawal)
    prismaMock.channelWithdrawal.delete.mockResolvedValue(baseWithdrawal)

    const req = makeRequest("DELETE")
    const res = await DELETE(req as any, makeContext("chan-1", "wd-1"))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual({ id: "wd-1" })
  })
})
