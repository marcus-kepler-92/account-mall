import { POST } from "@/app/api/admin/change-password/route"
import { prismaMock } from "../../../__mocks__/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))
jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn().mockResolvedValue("hashed-new") }))

const mockSession = { user: { id: "admin-1" } }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
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
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ password: "newpassword123" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when password is too short", async () => {
    const res = await POST(makeReq({ password: "short" }))
    expect(res.status).toBe(400)
  })

  it("updates password and clears mustChangePassword flag", async () => {
    prismaMock.account.updateMany.mockResolvedValue({ count: 1 } as any)
    prismaMock.user.update.mockResolvedValue({ id: "admin-1" } as any)

    const res = await POST(makeReq({ password: "newstrongpassword" }))
    expect(res.status).toBe(200)

    expect(prismaMock.account.updateMany).toHaveBeenCalledWith({
      where: { userId: "admin-1", providerId: "credential" },
      data: { password: "hashed-new" },
    })
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      data: { mustChangePassword: false },
    })
  })
})
