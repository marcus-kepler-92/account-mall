import { createChannelWithdrawalSchema } from "@/lib/validations/payment-channel"

describe("createChannelWithdrawalSchema - amount", () => {
    it("accepts decimal string (e.g. from text input)", () => {
        const result = createChannelWithdrawalSchema.safeParse({ amount: "1.5" })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.amount).toBe(1.5)
    })

    it("accepts integer string", () => {
        const result = createChannelWithdrawalSchema.safeParse({ amount: "100" })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.amount).toBe(100)
    })

    it("accepts numeric number (backward compat)", () => {
        const result = createChannelWithdrawalSchema.safeParse({ amount: 99.9 })
        expect(result.success).toBe(true)
        if (result.success) expect(result.data.amount).toBe(99.9)
    })

    it("rejects zero", () => {
        const result = createChannelWithdrawalSchema.safeParse({ amount: 0 })
        expect(result.success).toBe(false)
    })

    it("rejects empty string", () => {
        const result = createChannelWithdrawalSchema.safeParse({ amount: "" })
        expect(result.success).toBe(false)
    })

    it("rejects non-numeric string", () => {
        const result = createChannelWithdrawalSchema.safeParse({ amount: "abc" })
        expect(result.success).toBe(false)
    })

    it("rejects negative value", () => {
        const result = createChannelWithdrawalSchema.safeParse({ amount: -1 })
        expect(result.success).toBe(false)
    })
})
