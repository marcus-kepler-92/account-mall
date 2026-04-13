import { prismaMock } from "@/__mocks__/prisma"

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))

import { getAdminSession } from "@/lib/auth-guard"
import { GET } from "@/app/api/admin/withdrawals/count/route"

const mockSession = { user: { id: "u1", email: "admin@test.com" } }

describe("GET /api/admin/withdrawals/count", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns pending count", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.withdrawal.count.mockResolvedValue(3)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ pending: 3 })
    expect(prismaMock.withdrawal.count).toHaveBeenCalledWith({ where: { status: "PENDING" } })
  })

  it("returns 0 when no pending withdrawals", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.withdrawal.count.mockResolvedValue(0)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ pending: 0 })
  })
})
