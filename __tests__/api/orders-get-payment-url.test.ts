import { type NextRequest } from "next/server"
import { POST } from "@/app/api/orders/get-payment-url/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

jest.mock("better-auth/crypto", () => ({
  __esModule: true,
  verifyPassword: jest.fn(),
}))

jest.mock("@/lib/config", () => ({
  __esModule: true,
  config: { pendingOrderTimeoutMs: 15 * 60 * 1000 },
  getConfig: () => ({ pendingOrderTimeoutMs: 15 * 60 * 1000 }),
}))

const mockGetPaymentUrlForOrder = jest.fn()
jest.mock("@/lib/get-payment-url", () => ({
  __esModule: true,
  getPaymentUrlForOrder: (...args: unknown[]) => mockGetPaymentUrlForOrder(...args),
}))

import { verifyPassword } from "better-auth/crypto"

function createJsonRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

function createPendingOrder(createdAt: Date) {
  return {
    id: "order_1",
    orderNo: "FAK202402130001",
    passwordHash: "hash",
    status: "PENDING",
    amount: 99,
    product: { name: "Test Product" },
    createdAt,
  } as any
}

describe("POST /api/orders/get-payment-url", () => {
  const verifyPasswordMock = verifyPassword as jest.Mock

  beforeEach(() => {
    verifyPasswordMock.mockReset()
    mockGetPaymentUrlForOrder.mockReset()
    ;(prismaMock.$transaction as jest.Mock).mockReset()
  })

  it("returns 400 when JSON body is invalid", async () => {
    const req = {
      json: async () => {
        throw new Error("bad json")
      },
    } as unknown as NextRequest
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "Invalid JSON body" })
  })

  it("returns 400 when validation fails", async () => {
    const req = createJsonRequest({ orderNo: "", password: "short" })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toBe("Validation failed")
    expect(data.code).toBe("VALIDATION_FAILED")
  })

  it("returns 400 when order does not exist", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )
    prismaMock.order.findUnique.mockResolvedValueOnce(null)

    const req = createJsonRequest({ orderNo: "FAK999", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("订单不存在或密码错误")
  })

  it("returns 400 when password is incorrect", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )
    prismaMock.order.findUnique.mockResolvedValueOnce(
      createPendingOrder(new Date(Date.now() - 5 * 60 * 1000)),
    )
    verifyPasswordMock.mockResolvedValueOnce(false)

    const req = createJsonRequest({ orderNo: "FAK202402130001", password: "wrong123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("订单不存在或密码错误")
  })

  it("returns 400 when order is not PENDING", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )
    const order = createPendingOrder(new Date(Date.now() - 5 * 60 * 1000))
    order.status = "COMPLETED"
    prismaMock.order.findUnique.mockResolvedValueOnce(order)
    verifyPasswordMock.mockResolvedValueOnce(true)

    const req = createJsonRequest({ orderNo: "FAK202402130001", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("无法继续支付")
    expect(mockGetPaymentUrlForOrder).not.toHaveBeenCalled()
  })

  it("returns 400 when order has expired", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )
    const createdAt = new Date(Date.now() - 20 * 60 * 1000)
    prismaMock.order.findUnique.mockResolvedValueOnce(createPendingOrder(createdAt))
    verifyPasswordMock.mockResolvedValueOnce(true)

    const req = createJsonRequest({ orderNo: "FAK202402130001", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("无法继续支付")
    expect(mockGetPaymentUrlForOrder).not.toHaveBeenCalled()
  })

  it("returns 503 when payment URL cannot be generated", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )
    prismaMock.order.findUnique.mockResolvedValueOnce(
      createPendingOrder(new Date(Date.now() - 5 * 60 * 1000)),
    )
    verifyPasswordMock.mockResolvedValueOnce(true)
    mockGetPaymentUrlForOrder.mockReturnValueOnce(null)

    const req = createJsonRequest({ orderNo: "FAK202402130001", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(503)
    expect(data.error).toBe("支付暂不可用，请稍后重试")
  })

  it("returns 200 with paymentUrl when order is PENDING and not expired", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )
    prismaMock.order.findUnique.mockResolvedValueOnce(
      createPendingOrder(new Date(Date.now() - 5 * 60 * 1000)),
    )
    verifyPasswordMock.mockResolvedValueOnce(true)
    const fakeUrl = "https://pay.example.com/order/FAK202402130001"
    mockGetPaymentUrlForOrder.mockReturnValueOnce(fakeUrl)

    const req = createJsonRequest({ orderNo: "FAK202402130001", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ paymentUrl: fakeUrl })
    expect(mockGetPaymentUrlForOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNo: "FAK202402130001",
        totalAmount: "99.00",
        subject: "Test Product",
      }),
    )
  })

  it("passes clientType wap when provided", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )
    prismaMock.order.findUnique.mockResolvedValueOnce(
      createPendingOrder(new Date(Date.now() - 5 * 60 * 1000)),
    )
    verifyPasswordMock.mockResolvedValueOnce(true)
    mockGetPaymentUrlForOrder.mockReturnValueOnce("https://pay.example.com/wap")

    const req = createJsonRequest({
      orderNo: "FAK202402130001",
      password: "secret123",
      clientType: "wap",
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.paymentUrl).toBe("https://pay.example.com/wap")
    expect(mockGetPaymentUrlForOrder).toHaveBeenCalledWith(
      expect.objectContaining({ clientType: "wap" }),
    )
  })
})
