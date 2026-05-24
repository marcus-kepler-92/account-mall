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
  config: { siteName: "Account Mall", siteUrl: "http://localhost:3000", orderCompletionEmailEnabled: true },
}))

jest.mock("@/lib/email", () => ({
  __esModule: true,
  sendMail: jest.fn().mockResolvedValue({ success: true }),
}))

// Capture props passed into the OrderCompletion template via the render() call.
const renderMock = jest.fn().mockResolvedValue("<html><body>order stub</body></html>")
jest.mock("@react-email/render", () => ({
  render: (...args: unknown[]) => renderMock(...args),
}))

import { sendMail } from "@/lib/email"
import { sendOrderCompletionEmail } from "@/lib/order-completion-email"

type DeepMockPrisma = typeof prismaMock & PrismaClient

function getLastRenderProps(): Record<string, unknown> {
  const lastCall = renderMock.mock.calls[renderMock.mock.calls.length - 1]
  const element = lastCall?.[0] as { props: Record<string, unknown> } | undefined
  return element?.props ?? {}
}

describe("sendOrderCompletionEmail", () => {
  beforeEach(() => {
    ;(sendMail as jest.Mock).mockClear()
    renderMock.mockClear()
  })

  it("does not send when orderCompletionEmailEnabled is false", async () => {
    const { config } = require("@/lib/config") as { config: { orderCompletionEmailEnabled: boolean } }
    config.orderCompletionEmailEnabled = false

    ;(prismaMock as DeepMockPrisma).order.findUnique.mockResolvedValue({
      id: "order_1",
      orderNo: "ORD001",
      email: "buyer@example.com",
      status: "COMPLETED",
      quantity: 1,
      product: { name: "Test Product", productType: "NORMAL", emailOnFulfill: true },
      cards: [{ content: "card1" }],
      fulfillment: null,
    } as any)

    await sendOrderCompletionEmail("order_1")

    expect(sendMail).not.toHaveBeenCalled()
    config.orderCompletionEmailEnabled = true
  })

  it("does not send when product.emailOnFulfill is false (global enabled)", async () => {
    ;(prismaMock as DeepMockPrisma).order.findUnique.mockResolvedValue({
      id: "order_optout",
      orderNo: "ORD-OPTOUT",
      email: "buyer@example.com",
      status: "COMPLETED",
      quantity: 1,
      product: { name: "Silent Product", productType: "NORMAL", emailOnFulfill: false },
      cards: [{ content: "card1" }],
      fulfillment: null,
    } as any)

    await sendOrderCompletionEmail("order_optout")

    expect(sendMail).not.toHaveBeenCalled()
  })

  it("sends when both global flag and product.emailOnFulfill are true", async () => {
    ;(prismaMock as DeepMockPrisma).order.findUnique.mockResolvedValue({
      id: "order_optin",
      orderNo: "ORD-OPTIN",
      email: "buyer@example.com",
      status: "COMPLETED",
      quantity: 1,
      product: { name: "Loud Product", productType: "NORMAL", emailOnFulfill: true },
      cards: [{ content: "card1" }],
      fulfillment: null,
    } as any)

    await sendOrderCompletionEmail("order_optin")

    expect(sendMail).toHaveBeenCalledTimes(1)
  })

  it("does not send when product.emailOnFulfill is true but global is false", async () => {
    const { config } = require("@/lib/config") as { config: { orderCompletionEmailEnabled: boolean } }
    config.orderCompletionEmailEnabled = false

    ;(prismaMock as DeepMockPrisma).order.findUnique.mockResolvedValue({
      id: "order_globaloff",
      orderNo: "ORD-GLOBALOFF",
      email: "buyer@example.com",
      status: "COMPLETED",
      quantity: 1,
      product: { name: "Test Product", productType: "NORMAL", emailOnFulfill: true },
      cards: [{ content: "card1" }],
      fulfillment: null,
    } as any)

    await sendOrderCompletionEmail("order_globaloff")

    expect(sendMail).not.toHaveBeenCalled()
    config.orderCompletionEmailEnabled = true
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
      product: { name: "Test Product", productType: "NORMAL" },
      cards: [],
      fulfillment: null,
    } as any)

    await sendOrderCompletionEmail("order_1")

    expect(sendMail).not.toHaveBeenCalled()
  })

  it("logs error when sendMail returns success false", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    ;(sendMail as jest.Mock).mockResolvedValueOnce({ success: false })
    ;(prismaMock as DeepMockPrisma).order.findUnique.mockResolvedValue({
      id: "order_1",
      orderNo: "ORD001",
      email: "buyer@example.com",
      status: "COMPLETED",
      quantity: 1,
      product: { name: "Test Product", productType: "NORMAL", emailOnFulfill: true },
      cards: [{ content: "card1" }],
      fulfillment: null,
    } as any)

    await sendOrderCompletionEmail("order_1")

    expect(sendMail).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      "[order-completion-email] Send failed",
      expect.objectContaining({ orderId: "order_1", orderNo: "ORD001" })
    )
    consoleSpy.mockRestore()
  })

  it("assembles accountContent from cards for NORMAL order", async () => {
    ;(prismaMock as DeepMockPrisma).order.findUnique.mockResolvedValue({
      id: "ord1",
      orderNo: "ORD001",
      email: "buyer@example.com",
      status: "COMPLETED",
      quantity: 2,
      product: { name: "Test Product", productType: "NORMAL", emailOnFulfill: true },
      cards: [
        { content: "card1-content" },
        { content: "card2-content" },
      ],
      fulfillment: null,
    } as any)

    await sendOrderCompletionEmail("ord1")

    expect(sendMail).toHaveBeenCalledTimes(1)
    const props = getLastRenderProps()
    expect(props.accountContent).toBe("card1-content\n\ncard2-content")
    expect(props.cards).toBeUndefined()
  })

  it("assembles accountContent from fulfillment for MANUAL order", async () => {
    ;(prismaMock as DeepMockPrisma).order.findUnique.mockResolvedValue({
      id: "ord2",
      orderNo: "ORD002",
      email: "buyer@example.com",
      status: "COMPLETED",
      quantity: 1,
      product: { name: "Manual Product", productType: "MANUAL", emailOnFulfill: true },
      cards: [],
      fulfillment: { content: "manual-content" },
    } as any)

    await sendOrderCompletionEmail("ord2")

    expect(sendMail).toHaveBeenCalledTimes(1)
    const props = getLastRenderProps()
    expect(props.accountContent).toBe("manual-content")
  })

  it("warns and skips send when accountContent is empty", async () => {
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})
    ;(prismaMock as DeepMockPrisma).order.findUnique.mockResolvedValue({
      id: "ord3",
      orderNo: "ORD003",
      email: "buyer@example.com",
      status: "COMPLETED",
      quantity: 1,
      product: { name: "Manual Product", productType: "MANUAL", emailOnFulfill: true },
      cards: [],
      fulfillment: null,
    } as any)

    await sendOrderCompletionEmail("ord3")

    expect(sendMail).not.toHaveBeenCalled()
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[order-completion-email] empty accountContent for order",
      "ord3",
    )
    consoleWarnSpy.mockRestore()
  })
})
