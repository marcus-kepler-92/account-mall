import { NextRequest } from "next/server"
import { prismaMock } from "@/__mocks__/prisma"

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))
jest.mock("@/lib/email-marketing", () => ({ resolveRecipients: jest.fn() }))
jest.mock("@/lib/config", () => ({
  config: {
    resendApiKey: "test-resend-key",
    emailFrom: "Test <test@example.com>",
  },
}))

const mockBatchSend = jest.fn()
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    batch: { send: mockBatchSend },
  })),
}))

import { getAdminSession } from "@/lib/auth-guard"
import { resolveRecipients } from "@/lib/email-marketing"
import { POST } from "@/app/api/admin/email-marketing/campaigns/[id]/send/route"

const mockSession = { user: { id: "u1" } }
const makeParams = (id: string) => Promise.resolve({ id })

const baseCampaign = {
  id: "c1",
  name: "Test",
  subject: "Hello",
  html: "<p>Hi</p>",
  status: "DRAFT",
  recipientType: "CUSTOMERS",
  recipientFilter: { productIds: [] },
}

describe("POST /api/admin/email-marketing/campaigns/[id]/send", () => {
  beforeEach(() => {
    mockBatchSend.mockReset()
  })

  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const req = new NextRequest("http://localhost/", { method: "POST" })
    const res = await POST(req, { params: makeParams("c1") })
    expect(res.status).toBe(401)
  })

  it("returns 404 when campaign not found", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailCampaign.findUnique.mockResolvedValue(null)
    const req = new NextRequest("http://localhost/", { method: "POST" })
    const res = await POST(req, { params: makeParams("c1") })
    expect(res.status).toBe(404)
  })

  it("returns 409 when campaign is not DRAFT", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailCampaign.findUnique.mockResolvedValue({ ...baseCampaign, status: "SENT" } as never)
    const req = new NextRequest("http://localhost/", { method: "POST" })
    const res = await POST(req, { params: makeParams("c1") })
    expect(res.status).toBe(409)
  })

  it("returns 422 when no recipients", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailCampaign.findUnique.mockResolvedValue(baseCampaign as never)
    ;(resolveRecipients as jest.Mock).mockResolvedValue([])
    prismaMock.emailCampaign.update.mockResolvedValue({} as never)
    const req = new NextRequest("http://localhost/", { method: "POST" })
    const res = await POST(req, { params: makeParams("c1") })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("没有符合条件的收件人")
  })

  it("sends emails and returns success/fail counts", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailCampaign.findUnique.mockResolvedValue(baseCampaign as never)
    prismaMock.emailCampaign.update.mockResolvedValue({} as never)
    ;(resolveRecipients as jest.Mock).mockResolvedValue(["a@x.com", "b@x.com"])
    mockBatchSend.mockResolvedValue({
      data: { data: [{ id: "msg1" }, { id: "msg2" }] },
      error: null,
    })

    const req = new NextRequest("http://localhost/", { method: "POST" })
    const res = await POST(req, { params: makeParams("c1") })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.successCount).toBe(2)
    expect(body.failCount).toBe(0)
    expect(prismaMock.emailCampaign.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SENT", successCount: 2, failCount: 0 }),
      })
    )
  })

  it("counts failed results when batch returns no id", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailCampaign.findUnique.mockResolvedValue(baseCampaign as never)
    prismaMock.emailCampaign.update.mockResolvedValue({} as never)
    ;(resolveRecipients as jest.Mock).mockResolvedValue(["a@x.com", "b@x.com"])
    mockBatchSend.mockResolvedValue({
      data: { data: [{ id: "msg1" }, {}] },
      error: null,
    })

    const req = new NextRequest("http://localhost/", { method: "POST" })
    const res = await POST(req, { params: makeParams("c1") })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.successCount).toBe(1)
    expect(body.failCount).toBe(1)
  })

  it("sets FAILED status on thrown error", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.emailCampaign.findUnique.mockResolvedValue(baseCampaign as never)
    prismaMock.emailCampaign.update.mockResolvedValue({} as never)
    ;(resolveRecipients as jest.Mock).mockResolvedValue(["a@x.com"])
    mockBatchSend.mockRejectedValue(new Error("Network error"))

    const req = new NextRequest("http://localhost/", { method: "POST" })
    await expect(POST(req, { params: makeParams("c1") })).rejects.toThrow("Network error")
    expect(prismaMock.emailCampaign.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      })
    )
  })
})
