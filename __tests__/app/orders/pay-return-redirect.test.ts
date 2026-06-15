/**
 * /orders/pay-return redirect behavior.
 * Verifies the security invariant: token is only issued when Zpay sign is valid.
 * Covers: sign valid → awaiting-payment, sign invalid, no Zpay params, no orderNo, null token.
 */
import { prismaMock } from "../../../__mocks__/prisma"

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

const mockRedirect = jest.fn()
jest.mock("next/navigation", () => ({
    redirect: (url: string) => {
        mockRedirect(url)
        throw new Error(`NEXT_REDIRECT:${url}`)
    },
}))

jest.mock("@/lib/zpay", () => ({
    verifyZpayNotifySign: jest.fn(),
}))

jest.mock("@/lib/zpay-notify-complete", () => ({
    processZpayNotifyAndComplete: jest.fn().mockResolvedValue({ ok: true }),
}))

jest.mock("@/lib/order-success-token", () => ({
    createOrderSuccessToken: jest.fn().mockReturnValue("test-token"),
    verifyOrderSuccessToken: jest.fn(),
}))

// Stub UI components — they import CSS/JSX which doesn't matter for redirect tests
jest.mock("@/app/components/site-header", () => ({ SiteHeader: () => null }))
jest.mock("@/components/ui/button", () => ({ Button: () => null }))
jest.mock("@/components/ui/card", () => ({
    Card: () => null,
    CardContent: () => null,
    CardDescription: () => null,
    CardHeader: () => null,
    CardTitle: () => null,
}))

import { verifyZpayNotifySign } from "@/lib/zpay"
import { processZpayNotifyAndComplete } from "@/lib/zpay-notify-complete"
import { createOrderSuccessToken } from "@/lib/order-success-token"
import PayReturnPage from "@/app/orders/pay-return/page"

const verifySignMock = verifyZpayNotifySign as jest.Mock
const processNotifyMock = processZpayNotifyAndComplete as jest.Mock
const createTokenMock = createOrderSuccessToken as jest.Mock

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSearchParams(params: Record<string, string>) {
    return Promise.resolve(params) as Promise<Record<string, string | string[] | undefined>>
}

const ZPAY_PARAMS = {
    out_trade_no: "order-123",
    sign: "abc123",
    trade_status: "TRADE_SUCCESS",
    money: "99.00",
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("/orders/pay-return redirect behavior", () => {
    beforeEach(() => {
        mockRedirect.mockReset()
        verifySignMock.mockReset()
        processNotifyMock.mockReset()
        processNotifyMock.mockResolvedValue({ ok: true })
        createTokenMock.mockReturnValue("test-token")
        prismaMock.order.findFirst.mockResolvedValue(null) // no payment channel
    })

    it("redirects to awaiting-payment and fires notify completion when sign is valid", async () => {
        verifySignMock.mockReturnValue(true)

        await expect(
            PayReturnPage({ searchParams: makeSearchParams(ZPAY_PARAMS) }),
        ).rejects.toThrow("NEXT_REDIRECT")

        expect(mockRedirect).toHaveBeenCalledWith(
            expect.stringContaining("/orders/order-123/awaiting-payment?token="),
        )
        expect(mockRedirect).not.toHaveBeenCalledWith(expect.stringContaining("/success"))
        expect(processNotifyMock).toHaveBeenCalled()
    })

    it("does NOT redirect, does NOT issue token, does NOT call notify when sign is invalid", async () => {
        verifySignMock.mockReturnValue(false)

        await PayReturnPage({ searchParams: makeSearchParams(ZPAY_PARAMS) })

        expect(mockRedirect).not.toHaveBeenCalled()
        expect(createTokenMock).not.toHaveBeenCalled()
        expect(processNotifyMock).not.toHaveBeenCalled()
    })

    it("does NOT issue token when sign params are missing (no hasZpayParams)", async () => {
        await PayReturnPage({
            searchParams: makeSearchParams({ out_trade_no: "order-123" }),
        })

        expect(mockRedirect).not.toHaveBeenCalled()
        expect(createTokenMock).not.toHaveBeenCalled()
    })

    it("renders static fallback with lookup link when no out_trade_no", async () => {
        const result = await PayReturnPage({ searchParams: makeSearchParams({}) })
        expect(result).toBeDefined()
        expect(mockRedirect).not.toHaveBeenCalled()
    })

    it("falls back to static fallback when createOrderSuccessToken returns null (secret unconfigured)", async () => {
        verifySignMock.mockReturnValue(true)
        createTokenMock.mockReturnValue(null)

        const result = await PayReturnPage({ searchParams: makeSearchParams(ZPAY_PARAMS) })

        expect(result).toBeDefined()
        expect(mockRedirect).not.toHaveBeenCalled()
    })
})
