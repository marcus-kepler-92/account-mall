import { selectPaymentChannel } from "@/lib/payment-channel"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

import { prismaMock } from "../../__mocks__/prisma"

function makeChannel(overrides: Record<string, unknown> = {}) {
    return {
        id: "ch_1",
        nickname: "Test",
        pid: "pid1",
        key: "key1",
        submitUrl: "https://pay.example.com/submit.php",
        siteName: "Test Site",
        type: "alipay",
        annualLimit: 65000,
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    }
}

describe("selectPaymentChannel", () => {
    beforeEach(() => {
        prismaMock.paymentChannel.findMany.mockReset()
        prismaMock.order.groupBy.mockReset()
    })

    it("returns null when no active channels of that type", async () => {
        prismaMock.paymentChannel.findMany.mockResolvedValue([])
        const result = await selectPaymentChannel("alipay")
        expect(result).toBeNull()
    })

    it("returns first channel under annual limit", async () => {
        const ch1 = makeChannel({ id: "ch_1", sortOrder: 0 })
        const ch2 = makeChannel({ id: "ch_2", sortOrder: 1 })
        prismaMock.paymentChannel.findMany.mockResolvedValue([ch1, ch2])
        prismaMock.order.groupBy.mockResolvedValue([
            { paymentChannelId: "ch_1", _sum: { amount: 10000 } },
        ])
        const result = await selectPaymentChannel("alipay")
        expect(result?.id).toBe("ch_1")
    })

    it("skips channel at limit and returns next one", async () => {
        const ch1 = makeChannel({ id: "ch_1", sortOrder: 0, annualLimit: 65000 })
        const ch2 = makeChannel({ id: "ch_2", sortOrder: 1, annualLimit: 65000 })
        prismaMock.paymentChannel.findMany.mockResolvedValue([ch1, ch2])
        prismaMock.order.groupBy.mockResolvedValue([
            { paymentChannelId: "ch_1", _sum: { amount: 65000 } },
        ])
        const result = await selectPaymentChannel("alipay")
        expect(result?.id).toBe("ch_2")
    })

    it("returns channel with most remaining capacity when all are over limit", async () => {
        const ch1 = makeChannel({ id: "ch_1", sortOrder: 0, annualLimit: 65000 })
        const ch2 = makeChannel({ id: "ch_2", sortOrder: 1, annualLimit: 65000 })
        prismaMock.paymentChannel.findMany.mockResolvedValue([ch1, ch2])
        prismaMock.order.groupBy.mockResolvedValue([
            { paymentChannelId: "ch_1", _sum: { amount: 70000 } },
            { paymentChannelId: "ch_2", _sum: { amount: 66000 } },
        ])
        // ch_2 has more remaining capacity (65000-66000=-1000 vs 65000-70000=-5000)
        const result = await selectPaymentChannel("alipay")
        expect(result?.id).toBe("ch_2")
    })

    it("only queries channels of the requested type", async () => {
        prismaMock.paymentChannel.findMany.mockResolvedValue([])
        await selectPaymentChannel("wxpay")
        expect(prismaMock.paymentChannel.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ type: "wxpay" }),
            })
        )
    })

    it("treats channel with no orders as income=0", async () => {
        const ch1 = makeChannel({ id: "ch_1" })
        prismaMock.paymentChannel.findMany.mockResolvedValue([ch1])
        prismaMock.order.groupBy.mockResolvedValue([]) // no income rows
        const result = await selectPaymentChannel("alipay")
        expect(result?.id).toBe("ch_1")
    })
})
