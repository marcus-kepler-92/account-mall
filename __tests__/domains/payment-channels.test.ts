import { getChannelBalanceCents } from "@/lib/domains/payment-channels"
import { prismaMock } from "../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

describe("getChannelBalanceCents", () => {
  it("returns income minus withdrawals in cents", async () => {
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { amount: 100.5 } } as any)
    prismaMock.channelWithdrawal.aggregate.mockResolvedValue({ _sum: { amount: 30.2 } } as any)

    expect(await getChannelBalanceCents("chan-1")).toBe(7030) // (100.50 - 30.20) * 100
  })

  it("returns full income when no withdrawals", async () => {
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { amount: 500 } } as any)
    prismaMock.channelWithdrawal.aggregate.mockResolvedValue({ _sum: { amount: null } } as any)

    expect(await getChannelBalanceCents("chan-1")).toBe(50000)
  })

  it("returns 0 when no income and no withdrawals", async () => {
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { amount: null } } as any)
    prismaMock.channelWithdrawal.aggregate.mockResolvedValue({ _sum: { amount: null } } as any)

    expect(await getChannelBalanceCents("chan-1")).toBe(0)
  })

  it("avoids float precision error: income=100, withdrawn=89.7 → balance=1030 cents", async () => {
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { amount: 100 } } as any)
    prismaMock.channelWithdrawal.aggregate.mockResolvedValue({ _sum: { amount: 89.7 } } as any)

    // raw float: 100 - 89.7 = 10.299999999999997 → would give 1029 cents without toCents
    expect(await getChannelBalanceCents("chan-1")).toBe(1030)
  })
})
