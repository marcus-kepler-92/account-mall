import { POST } from "@/app/api/distributor/change-password/route"
import { prismaMock } from "../../../../__mocks__/prisma"
import { getSessionForDistributorArea } from "@/lib/auth-guard"
import { NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({ getSessionForDistributorArea: jest.fn() }))
jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn().mockResolvedValue("hashed-new") }))

const mockResult = { session: { user: { id: "dist-1" } }, disabled: false, mustChangePassword: true }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getSessionForDistributorArea as jest.Mock).mockResolvedValue(mockResult)
})

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/distributor/change-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("POST /api/distributor/change-password", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getSessionForDistributorArea as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ password: "newpassword123" }))
    expect(res.status).toBe(401)
  })

  it("returns 401 when distributor is disabled", async () => {
    ;(getSessionForDistributorArea as jest.Mock).mockResolvedValue({ ...mockResult, disabled: true })
    const res = await POST(makeReq({ password: "newpassword123" }))
    expect(res.status).toBe(401)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("returns 400 when password is 7 characters (boundary)", async () => {
    const res = await POST(makeReq({ password: "1234567" }))
    expect(res.status).toBe(400)
  })

  it("returns 200 when password is exactly 8 characters (boundary)", async () => {
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }, { id: "dist-1" }] as any)
    const res = await POST(makeReq({ password: "12345678" }))
    expect(res.status).toBe(200)
  })

  it("returns 400 when password exceeds 128 characters", async () => {
    const res = await POST(makeReq({ password: "a".repeat(129) }))
    expect(res.status).toBe(400)
  })

  it("is accessible while mustChangePassword is true (does not use getDistributorSession)", async () => {
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }, { id: "dist-1" }] as any)
    const res = await POST(makeReq({ password: "newstrongpassword" }))
    expect(res.status).toBe(200)
  })

  it("updates password and clears mustChangePassword flag atomically", async () => {
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }, { id: "dist-1" }] as any)
    const res = await POST(makeReq({ password: "newstrongpassword" }))
    expect(res.status).toBe(200)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })
})
