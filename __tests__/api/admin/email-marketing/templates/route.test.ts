import { NextRequest } from "next/server"
import { prismaMock } from "@/__mocks__/prisma"

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))

import { getAdminSession } from "@/lib/auth-guard"
import { GET, POST } from "@/app/api/admin/email-marketing/templates/route"

const mockSession = { user: { id: "u1" } }

describe("GET /api/admin/email-marketing/templates", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns template list ordered by createdAt desc", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const templates = [{ id: "t1", title: "T1" }, { id: "t2", title: "T2" }]
    prismaMock.emailTemplate.findMany.mockResolvedValue(templates as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(templates)
    expect(prismaMock.emailTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    )
  })
})

describe("POST /api/admin/email-marketing/templates", () => {
  const validPayload = {
    title: "My Template",
    defaultSubject: "Hello!",
    unlayerDesign: { body: {} },
    html: "<p>content</p>",
  }

  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 on invalid JSON", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 when required fields missing", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ title: "" }),
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("creates template and returns 201", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const created = { id: "t1", ...validPayload }
    prismaMock.emailTemplate.create.mockResolvedValue(created as never)
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify(validPayload),
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe("t1")
  })
})
