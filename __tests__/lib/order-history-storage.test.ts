/**
 * @jest-environment jsdom
 */
import { hasLocalOrderHistory, ORDER_HISTORY_KEY } from "@/lib/order-history-storage"

function makeValidItem(overrides?: Partial<Record<string, unknown>>) {
    return {
        orderNo: "order-abc-123",
        productName: "Test Product",
        amount: 99,
        createdAt: "2026-01-01T00:00:00.000Z",
        status: "PENDING",
        ...overrides,
    }
}

describe("hasLocalOrderHistory", () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it("returns false when localStorage is empty", () => {
        expect(hasLocalOrderHistory()).toBe(false)
    })

    it("returns true when localStorage has at least one valid order", () => {
        localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify([makeValidItem()]))
        expect(hasLocalOrderHistory()).toBe(true)
    })

    it("returns false when localStorage has an empty array", () => {
        localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify([]))
        expect(hasLocalOrderHistory()).toBe(false)
    })

    it("returns false when localStorage value is not valid JSON", () => {
        localStorage.setItem(ORDER_HISTORY_KEY, "not-valid-json{{")
        expect(hasLocalOrderHistory()).toBe(false)
    })

    it("returns false when localStorage value is valid JSON but fails Zod schema (wrong shape)", () => {
        // Array contains item with missing required fields
        localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify([{ foo: "bar" }]))
        expect(hasLocalOrderHistory()).toBe(false)
    })

    it("returns false when localStorage.getItem throws (SecurityError simulation)", () => {
        const getItemSpy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new DOMException("Access denied", "SecurityError")
        })
        expect(hasLocalOrderHistory()).toBe(false)
        getItemSpy.mockRestore()
    })
})
