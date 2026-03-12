import { type NextRequest } from "next/server"
import { GET } from "@/app/api/cron/close-expired-orders/route"
import { config } from "@/lib/config"

jest.mock("@/lib/config", () => {
  const c = {
    cronSecret: undefined as string | undefined,
    pendingOrderTimeoutMs: 900000,
  }
  return { __esModule: true, config: c, getConfig: () => c }
})

jest.mock("@/lib/close-expired-orders", () => ({
  __esModule: true,
  closeExpiredOrders: jest.fn(),
}))

import { closeExpiredOrders } from "@/lib/close-expired-orders"
const closeExpiredOrdersMock = closeExpiredOrders as jest.Mock

function createRequest(authHeader: string | null): NextRequest {
  const headers = new Headers()
  if (authHeader !== null) headers.set("authorization", authHeader)
  return {
    headers,
    method: "GET",
    url: "http://localhost/api/cron/close-expired-orders",
  } as unknown as NextRequest
}

describe("GET /api/cron/close-expired-orders", () => {
  beforeEach(() => {
    config.cronSecret = undefined
    closeExpiredOrdersMock.mockReset()
  })

  it("returns 503 when CRON_SECRET is not set", async () => {
    config.cronSecret = undefined
    const req = createRequest("Bearer any-secret")
    const res = await GET(req)
    const data = await res.json()
    expect(res.status).toBe(503)
    expect(data.error).toContain("CRON_SECRET")
    expect(closeExpiredOrdersMock).not.toHaveBeenCalled()
  })

  it("returns 401 when Authorization header is missing", async () => {
    config.cronSecret = "correct-secret"
    const req = createRequest(null)
    const res = await GET(req)
    const data = await res.json()
    expect(res.status).toBe(401)
    expect(data.error).toBe("Unauthorized")
    expect(closeExpiredOrdersMock).not.toHaveBeenCalled()
  })

  it("returns 401 when Bearer token does not match CRON_SECRET", async () => {
    config.cronSecret = "correct-secret"
    const req = createRequest("Bearer wrong-secret")
    const res = await GET(req)
    const data = await res.json()
    expect(res.status).toBe(401)
    expect(data.error).toBe("Unauthorized")
    expect(closeExpiredOrdersMock).not.toHaveBeenCalled()
  })

  it("returns 200 with { closed: 0, total: 0 } when no expired orders", async () => {
    config.cronSecret = "correct-secret"
    closeExpiredOrdersMock.mockResolvedValue({ closed: 0, total: 0 })
    const req = createRequest("Bearer correct-secret")
    const res = await GET(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data).toEqual({ closed: 0, total: 0 })
    expect(closeExpiredOrdersMock).toHaveBeenCalledTimes(1)
  })

  it("returns 200 with closed count when expired orders exist", async () => {
    config.cronSecret = "correct-secret"
    closeExpiredOrdersMock.mockResolvedValue({ closed: 2, total: 2 })
    const req = createRequest("Bearer correct-secret")
    const res = await GET(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.closed).toBe(2)
    expect(data.total).toBe(2)
  })
})
