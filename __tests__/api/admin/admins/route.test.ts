import { GET, POST } from "@/app/api/admin/admins/route"
import { prismaMock } from "../../../__mocks__/prisma"
import { getSuperAdminSession } from "@/lib/auth-guard"
import { NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({ getSuperAdminSession: jest.fn() }))
jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn().mockResolvedValue("hashed") }))

const mockSession = { user: { id: "super-1" } }
const mockAdmin = {
  id: "admin-2",
  email: "ops@example.com",
  username: null,
  name: "运维管理员",
  adminRole: "SYSTEM_OPS",
  createdAt: new Date("2025-01-01"),
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getSuperAdminSession as jest.Mock).mockResolvedValue(mockSession)
})

describe("GET /api/admin/admins", () => {
  it("returns 401 when not super admin", async () => {
    ;(getSuperAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns list of ADMIN users", async () => {
    prismaMock.user.findMany.mockResolvedValue([mockAdmin] as any)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].email).toBe("ops@example.com")
  })
})

describe("POST /api/admin/admins", () => {
  function makeReq(body: unknown) {
    return new NextRequest("http://localhost/api/admin/admins", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("returns 401 when not super admin", async () => {
    ;(getSuperAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ email: "x@x.com", name: "X", adminRole: null }))
    expect(res.status).toBe(401)
  })

  it("returns 400 on invalid body", async () => {
    const res = await POST(makeReq({ email: "not-an-email" }))
    expect(res.status).toBe(400)
  })

  it("returns 409 when email already exists", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing" } as any)
    const res = await POST(makeReq({ email: "ops@example.com", name: "Ops", adminRole: "SYSTEM_OPS" }))
    expect(res.status).toBe(409)
  })

  it("creates user and account, returns generated password", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
     
    ;(prismaMock.$transaction as any).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prismaMock)
    )
    prismaMock.user.create.mockResolvedValue({ ...mockAdmin, id: "new-1" } as any)
    prismaMock.account.create.mockResolvedValue({} as any)

    const res = await POST(makeReq({ email: "ops@example.com", name: "Ops", adminRole: "SYSTEM_OPS" }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.password).toBeDefined()
    expect(typeof body.password).toBe("string")
    expect(body.password.length).toBeGreaterThanOrEqual(16)
    expect(body.user.email).toBe("ops@example.com")
  })
})
