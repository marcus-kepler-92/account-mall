import { sendWecomNotification } from "@/lib/wecom-notify"
import { prisma } from "@/lib/prisma"
import { getSiteSettings } from "@/lib/site-settings"

jest.mock("@/lib/site-settings")
jest.mock("@/lib/prisma", () => ({
  prisma: { notificationLog: { create: jest.fn() } },
}))

global.fetch = jest.fn() as unknown as typeof fetch

const mockOrder = {
  id: "ord1", orderNo: "abc-123", amount: { toString: () => "29.90" },
  email: "b@x.com", status: "AWAITING_FULFILLMENT",
  productNameSnapshot: "Netflix 高级版", variantNameSnapshot: "3 个月",
} as any

describe("wecom-notify", () => {
  beforeEach(() => jest.clearAllMocks())

  it("no-op when wecomWebhookUrl is empty", async () => {
    ;(getSiteSettings as jest.Mock).mockResolvedValue({ wecomWebhookUrl: undefined })
    await sendWecomNotification("order.awaiting_fulfillment", mockOrder)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(prisma.notificationLog.create).not.toHaveBeenCalled()
  })

  it("POSTs markdown to the configured URL and logs success", async () => {
    ;(getSiteSettings as jest.Mock).mockResolvedValue({
      wecomWebhookUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=KEY",
    })
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })

    await sendWecomNotification("order.awaiting_fulfillment", mockOrder)

    expect(global.fetch).toHaveBeenCalledWith(
      "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=KEY",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("msgtype"),
      }),
    )
    expect(prisma.notificationLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ channel: "wecom", status: "sent", orderId: "ord1" }),
    }))
  })

  it("logs failure when fetch rejects", async () => {
    ;(getSiteSettings as jest.Mock).mockResolvedValue({
      wecomWebhookUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=KEY",
    })
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error("network"))

    await expect(
      sendWecomNotification("order.awaiting_fulfillment", mockOrder),
    ).resolves.toBeUndefined()

    expect(prisma.notificationLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "failed", error: expect.stringContaining("network") }),
    }))
  })
})
