import { NextRequest } from "next/server"
import { prismaMock } from "@/__mocks__/prisma"

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))

import { getAdminSession } from "@/lib/auth-guard"
import { GET, POST } from "@/app/api/admin/card-templates/route"
import { PATCH, DELETE } from "@/app/api/admin/card-templates/[id]/route"

const mockSession = { user: { id: "u1" } }

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

describe("GET /api/admin/card-templates", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns template list ordered by sortOrder", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const templates = [
      { id: "t1", name: "标准版", template: "{账号}----{密码}", sortOrder: 0, createdAt: new Date(), updatedAt: new Date(), _count: { products: 2 } },
    ]
    prismaMock.cardTemplate.findMany.mockResolvedValue(templates as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(prismaMock.cardTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { sortOrder: "asc" } })
    )
  })
})

describe("POST /api/admin/card-templates", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid template string", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ name: "X", template: "no-placeholders" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("creates template and returns 201", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.cardTemplate.aggregate.mockResolvedValue({ _max: { sortOrder: null } } as never)
    const created = {
      id: "t1", name: "标准版", template: "{账号}----{密码}",
      sortOrder: 0, createdAt: new Date(), updatedAt: new Date(), _count: { products: 0 },
    }
    prismaMock.cardTemplate.create.mockResolvedValue(created as never)
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ name: "标准版", template: "{账号}----{密码}" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe("标准版")
  })
})

describe("DELETE /api/admin/card-templates/[id]", () => {
  it("returns 400 when template is in use", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.cardTemplate.findUnique.mockResolvedValue({
      id: "t1", _count: { products: 3 }
    } as never)
    const res = await DELETE(
      new NextRequest("http://localhost/"),
      makeParams("t1")
    )
    expect(res.status).toBe(400)
  })

  it("returns 204 when template is unused", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.cardTemplate.findUnique.mockResolvedValue({
      id: "t1", _count: { products: 0 }
    } as never)
    prismaMock.cardTemplate.delete.mockResolvedValue({} as never)
    const res = await DELETE(
      new NextRequest("http://localhost/"),
      makeParams("t1")
    )
    expect(res.status).toBe(204)
  })
})
