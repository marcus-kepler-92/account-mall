import { NextRequest } from "next/server"
import { prismaMock } from "@/__mocks__/prisma"

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))

import { getAdminSession } from "@/lib/auth-guard"
import { GET, PUT, DELETE } from "@/app/api/admin/email-marketing/templates/[id]/route"

const mockSession = { user: { id: "u1" } }
const makeParams = (id: string) => Promise.resolve({ id })

const baseTemplate = {
  id: "t1",
  title: "My Template",
  description: null,
  defaultSubject: "Hello",
  html: "<p>hi</p>",
  unlayerDesign: { body: {} },
  isPreset: false,
}

describe("GET /api/admin/email-marketing/templates/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/")
    const res = await GET(req, { params: makeParams("t1") })
    expect(res.status).toBe(401)
  })

  it("returns 404 when template not found", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailTemplate.findUnique.mockResolvedValue(null)
    const req = new NextRequest("http://localhost/")
    const res = await GET(req, { params: makeParams("t1") })
    expect(res.status).toBe(404)
  })

  it("returns template", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailTemplate.findUnique.mockResolvedValue(baseTemplate as never)
    const req = new NextRequest("http://localhost/")
    const res = await GET(req, { params: makeParams("t1") })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe("t1")
  })
})

describe("PUT /api/admin/email-marketing/templates/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/", {
      method: "PUT",
      body: JSON.stringify({}),
    })
    const res = await PUT(req, { params: makeParams("t1") })
    expect(res.status).toBe(401)
  })

  it("returns 404 when template not found", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailTemplate.findUnique.mockResolvedValue(null)
    const req = new NextRequest("http://localhost/", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated" }),
      headers: { "content-type": "application/json" },
    })
    const res = await PUT(req, { params: makeParams("t1") })
    expect(res.status).toBe(404)
  })

  it("updates and returns template", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailTemplate.findUnique.mockResolvedValue(baseTemplate as never)
    const updated = { ...baseTemplate, title: "Updated" }
    prismaMock.emailTemplate.update.mockResolvedValue(updated as never)
    const req = new NextRequest("http://localhost/", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated" }),
      headers: { "content-type": "application/json" },
    })
    const res = await PUT(req, { params: makeParams("t1") })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe("Updated")
  })
})

describe("DELETE /api/admin/email-marketing/templates/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/", { method: "DELETE" })
    const res = await DELETE(req, { params: makeParams("t1") })
    expect(res.status).toBe(401)
  })

  it("returns 404 when template not found", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailTemplate.findUnique.mockResolvedValue(null)
    const req = new NextRequest("http://localhost/", { method: "DELETE" })
    const res = await DELETE(req, { params: makeParams("t1") })
    expect(res.status).toBe(404)
  })

  it("deletes template and returns 204", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailTemplate.findUnique.mockResolvedValue(baseTemplate as never)
    prismaMock.emailTemplate.delete.mockResolvedValue(baseTemplate as never)
    const req = new NextRequest("http://localhost/", { method: "DELETE" })
    const res = await DELETE(req, { params: makeParams("t1") })
    expect(res.status).toBe(204)
  })
})
