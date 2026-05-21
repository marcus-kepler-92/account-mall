import { agentLeadsSource } from "@/lib/admin-notifications/sources/agent-leads"

const findMany = jest.fn()
const count = jest.fn()

const prisma = {
  agentLead: { findMany, count },
} as unknown as Parameters<typeof agentLeadsSource.fetch>[0]

beforeEach(() => {
  findMany.mockReset()
  count.mockReset()
})

describe("agentLeadsSource", () => {
  it("counts NEW + CONTACTED, sorts HIGH urgency first then createdAt desc, take 3", async () => {
    count.mockResolvedValue(4)
    findMany.mockResolvedValue([
      { id: "l1", wechatId: "陈", status: "NEW", urgency: "HIGH", createdAt: new Date("2026-05-21T10:00:00Z") },
      { id: "l2", wechatId: null, status: "CONTACTED", urgency: "MED", createdAt: new Date("2026-05-21T09:00:00Z") },
      { id: "l3", wechatId: "王", status: "NEW", urgency: "LOW", createdAt: new Date("2026-05-21T08:00:00Z") },
    ])

    const result = await agentLeadsSource.fetch(prisma)

    expect(count).toHaveBeenCalledWith({ where: { status: { in: ["NEW", "CONTACTED"] } } })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ["NEW", "CONTACTED"] } },
        orderBy: { createdAt: "desc" },
      }),
    )
    expect((findMany.mock.calls[0][0] as { take: number }).take).toBeGreaterThanOrEqual(3)
    expect(result.count).toBe(4)
    expect(result.items[0].urgency).toBe("HIGH")
    expect(result.items[0].createdAt).toBe("2026-05-21T10:00:00.000Z")
  })

  it("returns empty items when no actionable leads", async () => {
    count.mockResolvedValue(0)
    findMany.mockResolvedValue([])
    const result = await agentLeadsSource.fetch(prisma)
    expect(result).toEqual({ count: 0, items: [] })
  })

  it("excludes PENDING_CONTACT (matches the 主待办 default filter on /admin/agent/leads)", async () => {
    count.mockResolvedValue(0)
    findMany.mockResolvedValue([])
    await agentLeadsSource.fetch(prisma)
    const where = count.mock.calls[0][0].where
    expect(where.status.in).not.toContain("PENDING_CONTACT")
  })
})
