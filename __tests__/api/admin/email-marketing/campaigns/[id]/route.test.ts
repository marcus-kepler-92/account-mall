import { NextRequest } from "next/server"
import { prismaMock } from "@/__mocks__/prisma"

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))

import { getAdminSession } from "@/lib/auth-guard"
import { GET, PUT, PATCH } from "@/app/api/admin/email-marketing/campaigns/[id]/route"

const mockSession = { user: { id: "u1" } }
const makeParams = (id: string) => Promise.resolve({ id })

describe("GET /api/admin/email-marketing/campaigns/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/")
    const res = await GET(req, { params: makeParams("c1") })
    expect(res.status).toBe(401)
  })

  it("returns 404 when campaign not found", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailCampaign.findUnique.mockResolvedValue(null)
    const req = new NextRequest("http://localhost/")
    const res = await GET(req, { params: makeParams("c1") })
    expect(res.status).toBe(404)
  })

  it("returns campaign", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const campaign = { id: "c1", name: "Test", status: "DRAFT", template: null }
    prismaMock.emailCampaign.findUnique.mockResolvedValue(campaign as never)
    const req = new NextRequest("http://localhost/")
    const res = await GET(req, { params: makeParams("c1") })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe("c1")
  })
})

describe("PUT /api/admin/email-marketing/campaigns/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/", {
      method: "PUT",
      body: JSON.stringify({}),
    })
    const res = await PUT(req, { params: makeParams("c1") })
    expect(res.status).toBe(401)
  })

  it("returns 404 when campaign not found", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailCampaign.findUnique.mockResolvedValue(null)
    const req = new NextRequest("http://localhost/", {
      method: "PUT",
      body: JSON.stringify({ name: "Updated" }),
      headers: { "content-type": "application/json" },
    })
    const res = await PUT(req, { params: makeParams("c1") })
    expect(res.status).toBe(404)
  })

  it("returns 409 when campaign is not DRAFT", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailCampaign.findUnique.mockResolvedValue({ status: "SENT" } as never)
    const req = new NextRequest("http://localhost/", {
      method: "PUT",
      body: JSON.stringify({ name: "Updated" }),
      headers: { "content-type": "application/json" },
    })
    const res = await PUT(req, { params: makeParams("c1") })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe("只有草稿状态的活动可以编辑")
  })

  it("updates DRAFT campaign", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailCampaign.findUnique.mockResolvedValue({ status: "DRAFT" } as never)
    const updated = { id: "c1", name: "Updated", status: "DRAFT" }
    prismaMock.emailCampaign.update.mockResolvedValue(updated as never)
    const req = new NextRequest("http://localhost/", {
      method: "PUT",
      body: JSON.stringify({ name: "Updated" }),
      headers: { "content-type": "application/json" },
    })
    const res = await PUT(req, { params: makeParams("c1") })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe("Updated")
  })
})

describe("PATCH /api/admin/email-marketing/campaigns/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/", { method: "PATCH" })
    const res = await PATCH(req, { params: makeParams("c1") })
    expect(res.status).toBe(401)
  })

  it("returns 404 when campaign not found", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailCampaign.findUnique.mockResolvedValue(null)
    const req = new NextRequest("http://localhost/", { method: "PATCH" })
    const res = await PATCH(req, { params: makeParams("c1") })
    expect(res.status).toBe(404)
  })

  it("returns 409 when campaign is not SENDING or FAILED", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailCampaign.findUnique.mockResolvedValue({ status: "DRAFT" } as never)
    const req = new NextRequest("http://localhost/", { method: "PATCH" })
    const res = await PATCH(req, { params: makeParams("c1") })
    expect(res.status).toBe(409)
  })

  it("resets SENDING campaign to DRAFT", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailCampaign.findUnique.mockResolvedValue({ status: "SENDING" } as never)
    const updated = { id: "c1", status: "DRAFT" }
    prismaMock.emailCampaign.update.mockResolvedValue(updated as never)
    const req = new NextRequest("http://localhost/", { method: "PATCH" })
    const res = await PATCH(req, { params: makeParams("c1") })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("DRAFT")
    expect(prismaMock.emailCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "DRAFT" } })
    )
  })

  it("resets FAILED campaign to DRAFT", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailCampaign.findUnique.mockResolvedValue({ status: "FAILED" } as never)
    const updated = { id: "c1", status: "DRAFT" }
    prismaMock.emailCampaign.update.mockResolvedValue(updated as never)
    const req = new NextRequest("http://localhost/", { method: "PATCH" })
    const res = await PATCH(req, { params: makeParams("c1") })
    expect(res.status).toBe(200)
  })
})
