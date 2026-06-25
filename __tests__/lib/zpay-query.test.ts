import { queryZpayOrder } from "@/lib/zpay"

jest.mock("@/lib/config", () => ({
    __esModule: true,
    config: {
        zpayPid: "test-pid",
        zpayKey: "test-key",
        zpaySubmitUrl: "https://z-pay.example/submit.php",
    },
}))

const fetchMock = jest.fn()
global.fetch = fetchMock as unknown as typeof fetch

function jsonResponse(body: unknown, ok = true, status = 200) {
    return {
        ok,
        status,
        json: async () => body,
    } as unknown as Response
}

describe("queryZpayOrder — 4-state classification", () => {
    beforeEach(() => {
        fetchMock.mockReset()
    })

    it("paid: code=1 + trade_status TRADE_SUCCESS", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ code: 1, trade_status: "TRADE_SUCCESS" }))
        expect(await queryZpayOrder("ord_1")).toEqual({ status: "paid" })
    })

    it("paid: code=1 + numeric status=1", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ code: 1, status: 1 }))
        expect(await queryZpayOrder("ord_1")).toEqual({ status: "paid" })
    })

    it("unpaid: gateway knows the order but it is not paid", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ code: 1, trade_status: "WAIT_BUYER_PAY", status: 0 }))
        expect(await queryZpayOrder("ord_1")).toEqual({ status: "unpaid" })
    })

    it("not_found: gateway positively reports no such order", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ code: -1, msg: "订单号不存在" }))
        expect(await queryZpayOrder("ord_1")).toEqual({ status: "not_found" })
    })

    it("error: unrecognized non-success code is treated conservatively (do not close)", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ code: -1, msg: "系统繁忙" }))
        expect(await queryZpayOrder("ord_1")).toEqual({ status: "error" })
    })

    it("error: http not ok", async () => {
        fetchMock.mockResolvedValue(jsonResponse({}, false, 502))
        expect(await queryZpayOrder("ord_1")).toEqual({ status: "error" })
    })

    it("error: fetch throws", async () => {
        fetchMock.mockRejectedValue(new Error("ETIMEDOUT"))
        expect(await queryZpayOrder("ord_1")).toEqual({ status: "error" })
    })
})

describe("queryZpayOrder — unconfigured", () => {
    it("error when credentials missing", async () => {
        jest.resetModules()
        jest.doMock("@/lib/config", () => ({
            __esModule: true,
            config: { zpayPid: undefined, zpayKey: undefined, zpaySubmitUrl: undefined },
        }))
        const { queryZpayOrder: q } = require("@/lib/zpay")
        expect(await q("ord_1")).toEqual({ status: "error" })
    })
})
