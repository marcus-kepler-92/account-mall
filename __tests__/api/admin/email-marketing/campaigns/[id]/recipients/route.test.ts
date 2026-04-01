import { NextRequest } from "next/server"

jest.mock("@/lib/prisma", () => ({ prisma: {} }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))
jest.mock("@/lib/email-marketing", () => ({ resolveRecipients: jest.fn() }))

import { getAdminSession } from "@/lib/auth-guard"
import { resolveRecipients } from "@/lib/email-marketing"
import { POST } from "@/app/api/admin/email-marketing/campaigns/[id]/recipients/route"

const mockSession = { user: { id: "u1" } }
const makeParams = (id: string) => Promise.resolve({ id })

describe("POST /api/admin/email-marketing/campaigns/[id]/recipients", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const res = await POST(req, { params: makeParams("c1") })
    expect(res.status).toBe(401)
  })

  it("returns 400 on invalid JSON", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req, { params: makeParams("c1") })
    expect(res.status).toBe(400)
  })

  it("returns 400 on validation failure", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({ recipientType: "INVALID" }),
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req, { params: makeParams("c1") })
    expect(res.status).toBe(400)
  })

  it("returns recipient count for CUSTOMERS", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    ;(resolveRecipients as jest.Mock).mockResolvedValue(["a@x.com", "b@x.com", "c@x.com"])
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({
        recipientType: "CUSTOMERS",
        recipientFilter: { productIds: [] },
      }),
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req, { params: makeParams("c1") })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(3)
  })

  it("returns recipient count for DISTRIBUTORS", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    ;(resolveRecipients as jest.Mock).mockResolvedValue(["d1@x.com", "d2@x.com"])
    const req = new NextRequest("http://localhost/", {
      method: "POST",
      body: JSON.stringify({
        recipientType: "DISTRIBUTORS",
        recipientFilter: { level: "all" },
      }),
      headers: { "content-type": "application/json" },
    })
    const res = await POST(req, { params: makeParams("c1") })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(2)
  })
})
