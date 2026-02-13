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
  getAdminEmail: jest.fn().mockReturnValue(""),
}))

import { sendMail, getAdminEmail } from "@/lib/email"
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
    ;(getAdminEmail as jest.Mock).mockClear()
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

  it("sends summary email to admin when admin email is configured", async () => {
    const subs = [
      { id: "sub_1", email: "a@example.com" },
      { id: "sub_2", email: "b@example.com" },
    ]
    ;(prismaMock as DeepMockPrisma).restockSubscription.findMany.mockResolvedValue(
      subs as any,
    )

    ;(getAdminEmail as jest.Mock).mockReturnValue("admin@test.com")

    await notifyRestockSubscribers(product)

    const sendMailMock = sendMail as jest.Mock
    // two user emails + one admin email
    expect(sendMailMock).toHaveBeenCalledTimes(3)

    expect(sendMailMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        to: "admin@test.com",
        subject: expect.stringContaining("商品补货通知"),
      }),
    )
  })

  it("does not send admin email when admin email is empty", async () => {
    const subs = [{ id: "sub_1", email: "a@example.com" }]
    ;(prismaMock as DeepMockPrisma).restockSubscription.findMany.mockResolvedValue(
      subs as any,
    )

    ;(getAdminEmail as jest.Mock).mockReturnValue("")

    await notifyRestockSubscribers(product)

    const sendMailMock = sendMail as jest.Mock
    // only user email
    expect(sendMailMock).toHaveBeenCalledTimes(1)
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "a@example.com",
      }),
    )
  })
})

