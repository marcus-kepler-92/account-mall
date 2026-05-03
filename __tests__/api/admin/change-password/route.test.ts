import { POST } from "@/app/api/admin/change-password/route"
import { prismaMock } from "../../../__mocks__/prisma"
import { getSessionForAdminArea } from "@/lib/auth-guard"
import { NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({ getSessionForAdminArea: jest.fn() }))
jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn().mockResolvedValue("hashed-new") }))

const mockResult = { session: { user: { id: "admin-1" } }, role: "ADMIN", adminRole: null, mustChangePassword: false }
const mockResultMustChange = { session: { user: { id: "admin-1" } }, role: "ADMIN", adminRole: null, mustChangePassword: true }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getSessionForAdminArea as jest.Mock).mockResolvedValue(mockResult)
})

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/change-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("POST /api/admin/change-password", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getSessionForAdminArea as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ password: "newpassword123" }))
    expect(res.status).toBe(401)
  })

  it("returns 401 when role is not ADMIN", async () => {
    ;(getSessionForAdminArea as jest.Mock).mockResolvedValue({ session: { user: { id: "d1" } }, role: "DISTRIBUTOR", adminRole: null, mustChangePassword: false })
    const res = await POST(makeReq({ password: "newpassword123" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when password is 7 characters (boundary)", async () => {
    const res = await POST(makeReq({ password: "1234567" }))
    expect(res.status).toBe(400)
  })

  it("returns 200 when password is exactly 8 characters (boundary)", async () => {
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }, { id: "admin-1" }] as any)
    const res = await POST(makeReq({ password: "12345678" }))
    expect(res.status).toBe(200)
  })

  it("returns 400 when password exceeds 128 characters", async () => {
    const res = await POST(makeReq({ password: "a".repeat(129) }))
    expect(res.status).toBe(400)
  })

  it("is accessible when mustChangePassword is true (bypasses getAdminSession guard)", async () => {
    ;(getSessionForAdminArea as jest.Mock).mockResolvedValue(mockResultMustChange)
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }, { id: "admin-1" }] as any)
    const res = await POST(makeReq({ password: "newstrongpassword" }))
    expect(res.status).toBe(200)
  })

  it("updates password and clears mustChangePassword flag atomically", async () => {
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }, { id: "admin-1" }] as any)

    const res = await POST(makeReq({ password: "newstrongpassword" }))
    expect(res.status).toBe(200)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })
})
