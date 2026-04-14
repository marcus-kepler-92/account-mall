import { PATCH, DELETE } from "@/app/api/admin/admins/[id]/route"
import { prismaMock } from "../../../../__mocks__/prisma"
import { getSuperAdminSession } from "@/lib/auth-guard"
import { NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({ getSuperAdminSession: jest.fn() }))
jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})
jest.mock("better-auth/crypto", () => ({ hashPassword: jest.fn().mockResolvedValue("hashed") }))

const mockSession = { user: { id: "super-1" } }

beforeEach(() => {
  jest.clearAllMocks()
  ;(getSuperAdminSession as jest.Mock).mockResolvedValue(mockSession)
})

function makeReq(body: unknown, id = "admin-2") {
  return new NextRequest(`http://localhost/api/admin/admins/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function makeContext(id = "admin-2") {
  return { params: Promise.resolve({ id }) }
}

describe("PATCH /api/admin/admins/[id]", () => {
  it("returns 401 when not super admin", async () => {
    ;(getSuperAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await PATCH(makeReq({ action: "updateRole", adminRole: null }), makeContext())
    expect(res.status).toBe(401)
  })

  it("returns 400 on invalid action", async () => {
    const res = await PATCH(makeReq({ action: "badAction" }), makeContext())
    expect(res.status).toBe(400)
  })

  it("updateRole returns 400 when trying to update self", async () => {
    const res = await PATCH(makeReq({ action: "updateRole", adminRole: null }), makeContext("super-1"))
    expect(res.status).toBe(400)
  })

  it("updateRole returns 404 when target not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    const res = await PATCH(makeReq({ action: "updateRole", adminRole: "SYSTEM_OPS" }), makeContext())
    expect(res.status).toBe(404)
  })

  it("updateRole updates adminRole", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "admin-2", role: "ADMIN" } as any)
    prismaMock.user.update.mockResolvedValue({ id: "admin-2", adminRole: "SYSTEM_OPS" } as any)
    const res = await PATCH(makeReq({ action: "updateRole", adminRole: "SYSTEM_OPS" }), makeContext())
    expect(res.status).toBe(200)
  })

  it("resetPassword returns new password", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "admin-2", role: "ADMIN" } as any)
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }, { id: "admin-2" }] as any)

    const res = await PATCH(makeReq({ action: "resetPassword" }), makeContext())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.password).toBeDefined()
    expect(body.password.length).toBeGreaterThanOrEqual(16)
  })

  it("resetPassword returns 404 when admin has no credential account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "admin-2", role: "ADMIN" } as any)
    prismaMock.$transaction.mockResolvedValue([{ count: 0 }, {}] as any)

    const res = await PATCH(makeReq({ action: "resetPassword" }), makeContext())
    expect(res.status).toBe(404)
  })
})

describe("DELETE /api/admin/admins/[id]", () => {
  function makeDeleteReq(id = "admin-2") {
    return new NextRequest(`http://localhost/api/admin/admins/${id}`, { method: "DELETE" })
  }

  it("returns 401 when not super admin", async () => {
    ;(getSuperAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(makeDeleteReq(), makeContext())
    expect(res.status).toBe(401)
  })

  it("returns 400 when trying to delete self", async () => {
    const res = await DELETE(makeDeleteReq("super-1"), makeContext("super-1"))
    expect(res.status).toBe(400)
  })

  it("returns 404 when user not found", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    const res = await DELETE(makeDeleteReq(), makeContext())
    expect(res.status).toBe(404)
  })

  it("deletes the admin user", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "admin-2", role: "ADMIN" } as any)
    prismaMock.user.delete.mockResolvedValue({ id: "admin-2" } as any)
    const res = await DELETE(makeDeleteReq(), makeContext())
    expect(res.status).toBe(200)
  })
})
