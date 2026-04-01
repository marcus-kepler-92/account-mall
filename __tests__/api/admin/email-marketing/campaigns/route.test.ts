import { NextRequest } from "next/server"
import { prismaMock } from "@/__mocks__/prisma"

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))

import { getAdminSession } from "@/lib/auth-guard"
import { GET, POST } from "@/app/api/admin/email-marketing/campaigns/route"

const mockSession = { user: { id: "u1", email: "admin@test.com" } }

describe("GET /api/admin/email-marketing/campaigns", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns campaign list", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const campaigns = [{ id: "c1", name: "Test", status: "DRAFT" }]
    prismaMock.emailCampaign.findMany.mockResolvedValue(campaigns as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(campaigns)
  })
})

describe("POST /api/admin/email-marketing/campaigns", () => {
  const validPayload = {
    name: "Campaign 1",
    subject: "Hello",
    html: "<p>Hi</p>",
    recipientType: "CUSTOMERS",
    recipientFilter: { productIds: [] },
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

  it("returns 400 on validation failure", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("creates campaign and returns 201", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const created = { id: "c1", ...validPayload, status: "DRAFT" }
    prismaMock.emailCampaign.create.mockResolvedValue(created as never)
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify(validPayload),
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe("c1")
  })
})
