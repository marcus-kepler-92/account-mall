import { PrismaClient } from "@prisma/client"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../__mocks__/prisma")
  return {
    __esModule: true,
    prisma: prismaMock,
  }
})

jest.mock("@/lib/email", () => ({
  __esModule: true,
  sendMail: jest.fn().mockResolvedValue({ success: true }),
}))

jest.mock("@react-email/render", () => ({
  render: jest.fn().mockResolvedValue("<html><body>stub</body></html>"),
}))

import { sendMail } from "@/lib/email"
import { notifyRestockSubscribers } from "@/lib/restock-notify"

type DeepMockPrisma = typeof prismaMock & PrismaClient

describe("notifyRestockSubscribers", () => {
  const product = {
    id: "prod_1",
    name: "Test Product",
    slug: "test-product",
    price: 19.9,
  }

  beforeEach(() => {
    ;(sendMail as jest.Mock).mockClear()
  })

  it("does nothing when there are no pending subscriptions", async () => {
    ;(prismaMock as DeepMockPrisma).restockSubscription.findMany.mockResolvedValue(
      [],
    )

    await notifyRestockSubscribers(product)

    expect(
      (prismaMock as DeepMockPrisma).restockSubscription.findMany,
    ).toHaveBeenCalled()
    expect(
      (prismaMock as DeepMockPrisma).restockSubscription.updateMany,
    ).not.toHaveBeenCalled()
    expect(sendMail).not.toHaveBeenCalled()
  })

  it("sends emails to pending subscribers and updates their status", async () => {
    const subs = [
      { id: "sub_1", email: "a@example.com" },
      { id: "sub_2", email: "b@example.com" },
    ]

    ;(prismaMock as DeepMockPrisma).restockSubscription.findMany.mockResolvedValue(
      subs as any,
    )

    await notifyRestockSubscribers(product)

    expect(sendMail).toHaveBeenCalledTimes(subs.length)
    for (const sub of subs) {
      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: sub.email,
          subject: "[Account Mall] 你关注的商品已补货",
        }),
      )
    }

    expect(
      (prismaMock as DeepMockPrisma).restockSubscription.updateMany,
    ).toHaveBeenCalledWith({
      where: { id: { in: ["sub_1", "sub_2"] } },
      data: { status: "NOTIFIED", notifiedAt: expect.any(Date) },
    })
  })

  it("only updates successfully notified subscribers when some sends fail", async () => {
    const subs = [
      { id: "sub_1", email: "ok@example.com" },
      { id: "sub_2", email: "fail@example.com" },
    ]
    ;(prismaMock as DeepMockPrisma).restockSubscription.findMany.mockResolvedValue(
      subs as any,
    )

    const sendMailMock = sendMail as jest.Mock
    sendMailMock.mockResolvedValueOnce({ success: true })
    sendMailMock.mockResolvedValueOnce({ success: false })

    await notifyRestockSubscribers(product)

    expect(sendMailMock).toHaveBeenCalledTimes(2)
    expect(
      (prismaMock as DeepMockPrisma).restockSubscription.updateMany,
    ).toHaveBeenCalledWith({
      where: { id: { in: ["sub_1"] } },
      data: { status: "NOTIFIED", notifiedAt: expect.any(Date) },
    })
  })
})

