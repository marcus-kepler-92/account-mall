import { withdrawalsSource } from "@/lib/admin-notifications/sources/withdrawals"
import { SOURCE_ITEM_TAKE } from "@/lib/admin-notifications/constants"

const findMany = jest.fn()
const count = jest.fn()

const prisma = {
  withdrawal: { findMany, count },
} as unknown as Parameters<typeof withdrawalsSource.fetch>[0]

beforeEach(() => {
  findMany.mockReset()
  count.mockReset()
})

describe("withdrawalsSource", () => {
  it("counts PENDING withdrawals and returns the latest items with distributor names + fingerprint", async () => {
    count.mockResolvedValue(7)
    findMany.mockResolvedValue([
      { id: "w1", amount: 200, createdAt: new Date("2026-05-21T10:00:00Z"), distributor: { name: "张三" } },
      { id: "w2", amount: 80, createdAt: new Date("2026-05-21T09:00:00Z"), distributor: { name: "李四" } },
      { id: "w3", amount: 150, createdAt: new Date("2026-05-21T08:00:00Z"), distributor: { name: null, email: "wang@example.com" } },
    ])

    const result = await withdrawalsSource.fetch(prisma)

    expect(count).toHaveBeenCalledWith({ where: { status: "PENDING" } })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PENDING" },
        take: SOURCE_ITEM_TAKE,
        orderBy: { createdAt: "desc" },
      }),
    )
    expect(result.count).toBe(7)
    expect(result.items).toHaveLength(3)
    expect(result.items[0]).toEqual({
      id: "w1",
      fingerprint: "v1",
      distributorName: "张三",
      amount: 200,
      createdAt: "2026-05-21T10:00:00.000Z",
    })
    expect(result.items[2].distributorName).toBe("wang@example.com")
  })

  it("returns empty items when no pending withdrawals", async () => {
    count.mockResolvedValue(0)
    findMany.mockResolvedValue([])
    const result = await withdrawalsSource.fetch(prisma)
    expect(result.count).toBe(0)
    expect(result.items).toEqual([])
  })
})
