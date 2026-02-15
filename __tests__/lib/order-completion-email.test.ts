import { PrismaClient } from "@prisma/client"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../__mocks__/prisma")
  return {
    __esModule: true,
    prisma: prismaMock,
  }
})

jest.mock("@/lib/config", () => ({
  config: { siteName: "Account Mall", siteUrl: "http://localhost:3000" },
}))

jest.mock("@/lib/email", () => ({
  __esModule: true,
  sendMail: jest.fn().mockResolvedValue({ success: true }),
}))

jest.mock("@react-email/render", () => ({
  render: jest.fn().mockResolvedValue("<html><body>order stub</body></html>"),
}))

import { sendMail } from "@/lib/email"
import { sendOrderCompletionEmail } from "@/lib/order-completion-email"

type DeepMockPrisma = typeof prismaMock & PrismaClient

describe("sendOrderCompletionEmail", () => {
  beforeEach(() => {
    ;(sendMail as jest.Mock).mockClear()
  })

  it("does not send when order is not found", async () => {
    ;(prismaMock as DeepMockPrisma).order.findUnique.mockResolvedValue(null)

    await sendOrderCompletionEmail("order_1")

    expect(sendMail).not.toHaveBeenCalled()
  })

  it("does not send when order status is not COMPLETED", async () => {
    ;(prismaMock as DeepMockPrisma).order.findUnique.mockResolvedValue({
      id: "order_1",
      orderNo: "ORD001",
      email: "buyer@example.com",
      status: "PENDING",
      quantity: 1,
      product: { name: "Test Product" },
      cards: [],
    } as any)

    await sendOrderCompletionEmail("order_1")

    expect(sendMail).not.toHaveBeenCalled()
  })

  it("sends email with order and card info when order is COMPLETED", async () => {
    ;(prismaMock as DeepMockPrisma).order.findUnique.mockResolvedValue({
      id: "order_1",
      orderNo: "ORD001",
      email: "buyer@example.com",
      status: "COMPLETED",
      quantity: 2,
      product: { name: "Test Product" },
      cards: [
        { content: "account1:password1" },
        { content: "account2:password2" },
      ],
    } as any)

    await sendOrderCompletionEmail("order_1")

    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "buyer@example.com",
        subject: "[Account Mall] 订单已完成：您的账号信息",
        html: "<html><body>order stub</body></html>",
      }),
    )
  })
})
